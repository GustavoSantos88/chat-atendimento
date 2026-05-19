<?php
session_start();
require_once '../classes/Database.php';
require_once '../classes/Atendimento.php';
require_once '../classes/RoundRobin.php';
require_once '../config/app.php';

header('Content-Type: application/json');
if (!isset($_SESSION['atendente_id'])) {
    http_response_code(403);
    echo json_encode(['erro' => 'Não autenticado']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$pdo = Database::getConn();

// --------------------------------------------------------------
// GET
// --------------------------------------------------------------
// Se for action=get_setor, retorna o setor_id de um atendimento específico
if ($method === 'GET') {
    $is_admin = ($_SESSION['atendente_id'] == 1);
    $setor_id = isset($_GET['setor_id']) && is_numeric($_GET['setor_id']) ? (int)$_GET['setor_id'] : null;
    $status = isset($_GET['status']) ? $_GET['status'] : '';
    $status = trim($status);

    if ($is_admin) {
        $sql = "
            SELECT a.*, c.nome as cliente_nome, c.telefone, s.nome as setor_nome
            FROM atendimentos a
            LEFT JOIN clientes c ON a.cliente_id = c.id
            LEFT JOIN setores s ON a.setor_id = s.id
            WHERE 1=1
        ";
        if ($setor_id) {
            $sql .= " AND a.setor_id = :setor_id";
        }
        if (!empty($status)) {
            $sql .= " AND a.status = :status";
        }
        $sql .= " ORDER BY a.data_abertura ASC";
        $stmt = $pdo->prepare($sql);
        if ($setor_id) $stmt->bindParam(':setor_id', $setor_id, PDO::PARAM_INT);
        if (!empty($status)) $stmt->bindParam(':status', $status, PDO::PARAM_STR);
        $stmt->execute();
    } else {
        // Atendente comum vê apenas os próprios atendimentos (não precisa de filtro de status, apenas os ativos)
        $sql = "
            SELECT a.*, c.nome as cliente_nome, c.telefone, s.nome as setor_nome
            FROM atendimentos a
            LEFT JOIN clientes c ON a.cliente_id = c.id
            LEFT JOIN setores s ON a.setor_id = s.id
            WHERE a.status IN ('aberto', 'transferido')
              AND a.atendente_atual_id = ?
            ORDER BY a.data_abertura ASC
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$_SESSION['atendente_id']]);
    }

    echo json_encode($stmt->fetchAll());
    exit;
}

// --------------------------------------------------------------
// POST (ações: transferir, finalizar, proximo)
// --------------------------------------------------------------
if ($method === 'POST' && isset($_GET['action'])) {

    // ---------- TRANSFERIR ----------
    if ($_GET['action'] === 'transferir') {
        $input = file_get_contents('php://input');
        error_log("Transferir - dados recebidos: " . $input);
        $data = json_decode($input, true);
        if (!$data || !isset($data['atendimento_id']) || !isset($data['atendente_id'])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Dados incompletos']);
            exit;
        }

        $atendimentoId = (int)$data['atendimento_id'];
        $novoAtendenteId = (int)$data['atendente_id'];

        try {
            // Buscar dados do atendimento (incluindo session_id e telefone)
            $stmt = $pdo->prepare("
            SELECT a.atendente_atual_id, a.session_id, c.telefone, s.nome as setor_nome
            FROM atendimentos a
            JOIN clientes c ON a.cliente_id = c.id
            JOIN setores s ON a.setor_id = s.id
            WHERE a.id = ?
        ");
            $stmt->execute([$atendimentoId]);
            $atend = $stmt->fetch();
            if (!$atend) throw new Exception('Atendimento não encontrado');

            $atendenteOrigem = $atend['atendente_atual_id'];
            $sessionId = $atend['session_id'];
            $telefoneCliente = $atend['telefone'];

            // Buscar nome do novo atendente
            $stmtAtendente = $pdo->prepare("SELECT nome FROM atendentes WHERE id = ?");
            $stmtAtendente->execute([$novoAtendenteId]);
            $novoAtendente = $stmtAtendente->fetch();
            $nomeNovoAtendente = $novoAtendente ? $novoAtendente['nome'] : 'Atendente';

            $pdo->beginTransaction();

            // 1. Atualizar atendimento
            $stmt = $pdo->prepare("UPDATE atendimentos SET atendente_atual_id = ?, status = 'transferido' WHERE id = ?");
            $stmt->execute([$novoAtendenteId, $atendimentoId]);

            // 2. Histórico novo atendente
            if (method_exists('Atendimento', 'adicionarHistorico')) {
                Atendimento::adicionarHistorico($atendimentoId, $novoAtendenteId, 'transferencia');
            } else {
                $stmt = $pdo->prepare("INSERT INTO atendimento_atendentes (atendimento_id, atendente_id, tipo, data_entrada) VALUES (?, ?, 'transferencia', NOW())");
                $stmt->execute([$atendimentoId, $novoAtendenteId]);
            }

            // 3. Fechar período do atendente anterior
            if ($atendenteOrigem) {
                $stmt = $pdo->prepare("UPDATE atendimento_atendentes SET data_saida = NOW() WHERE atendimento_id = ? AND atendente_id = ? AND data_saida IS NULL");
                $stmt->execute([$atendimentoId, $atendenteOrigem]);
            } else {
                $stmt = $pdo->prepare("UPDATE atendimento_atendentes SET data_saida = NOW() WHERE atendimento_id = ? AND data_saida IS NULL");
                $stmt->execute([$atendimentoId]);
            }

            // 4. Inserir mensagem de sistema informando a transferência
            $mensagemTexto = "🔄 Atendimento transferido";
            if ($atendenteOrigem) {
                $stmtOrigem = $pdo->prepare("SELECT nome FROM atendentes WHERE id = ?");
                $stmtOrigem->execute([$atendenteOrigem]);
                $origemNome = $stmtOrigem->fetchColumn();
                $mensagemTexto .= " de " . ($origemNome ?: "Atendente anterior");
            } else {
                $mensagemTexto .= " da fila";
            }
            $mensagemTexto .= " para " . $nomeNovoAtendente;

            $stmtMsg = $pdo->prepare("
            INSERT INTO mensagens (atendimento_id, session_id, remetente_tipo, direcao, tipo, mensagem, data_envio)
            VALUES (?, ?, 'sistema', 'entrada', 'texto', ?, NOW())
        ");
            $stmtMsg->execute([$atendimentoId, $sessionId, $mensagemTexto]);

            $pdo->commit();

            // Enviar mensagem ao cliente (opcional, mas desejável)
            $mensagemCliente = "🔄 Seu atendimento foi transferido para *{$nomeNovoAtendente}*. Aguarde um momento.";
            $url = BASE_URL_API . 'api/send';
            $postData = ['sessionId' => $sessionId, 'number' => $telefoneCliente, 'message' => $mensagemCliente];
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'X-API-KEY: ' . API_KEY]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_exec($ch);
            curl_close($ch);

            echo json_encode(['status' => 'ok']);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log("Erro transferência: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        exit;
    } elseif ($_GET['action'] === 'finalizar') {
        $input = file_get_contents('php://input');
        error_log("Finalizar - dados: " . $input);
        $data = json_decode($input, true);
        if (!$data || !isset($data['atendimento_id'])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Dados incompletos']);
            exit;
        }

        $atendimentoId = (int)$data['atendimento_id'];

        try {
            $stmt = $pdo->prepare("SELECT atendente_atual_id, setor_id FROM atendimentos WHERE id = ?");
            $stmt->execute([$atendimentoId]);
            $atend = $stmt->fetch();
            if (!$atend) throw new Exception('Atendimento não encontrado');
            if ($atend['atendente_atual_id'] != $_SESSION['atendente_id'] && $_SESSION['atendente_id'] != 1) {
                throw new Exception('Permissão negada');
            }

            $pdo->beginTransaction();

            // Finalizar atendimento
            $stmt = $pdo->prepare("UPDATE atendimentos SET status = 'finalizado', data_fechamento = NOW() WHERE id = ?");
            $stmt->execute([$atendimentoId]);
            $stmt = $pdo->prepare("UPDATE atendimento_atendentes SET data_saida = NOW() WHERE atendimento_id = ? AND data_saida IS NULL");
            $stmt->execute([$atendimentoId]);

            $pdo->commit();

            // ----------------------------------------------------------
            // Enviar mensagem de encerramento ao cliente 
            // ----------------------------------------------------------
            $stmtCliente = $pdo->prepare("
                SELECT c.telefone, a.session_id 
                FROM atendimentos a 
                JOIN clientes c ON a.cliente_id = c.id 
                WHERE a.id = ?
            ");
            $stmtCliente->execute([$atendimentoId]);
            $clienteData = $stmtCliente->fetch();
            if ($clienteData) {
                $telefone = $clienteData['telefone'];
                $sessionId = $clienteData['session_id'];
                $mensagemEncerramento = "✅ Seu atendimento foi finalizado. Agradecemos o contato! Caso precise, inicie um novo atendimento enviando uma mensagem.";

                // Usa a mesma configuração que funciona no WebhookHandler
                $url = BASE_URL_API . 'api/send';
                $postData = [
                    'sessionId' => $sessionId,
                    'number'    => $telefone,
                    'message'   => $mensagemEncerramento
                ];

                $ch = curl_init($url);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Content-Type: application/json',
                    'X-API-KEY: ' . API_KEY
                ]);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // para testes, depois remova
                curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlError = curl_error($ch);
                curl_close($ch);

                // Log detalhado para depuração
                error_log("Encerramento - Telefone: $telefone, HTTP: $httpCode, Resposta: " . substr($response, 0, 200));
                if ($curlError) {
                    error_log("Erro cURL no encerramento: $curlError");
                }

                // Se ainda assim falhar, registra mas não impede o fluxo
                if ($httpCode != 200) {
                    error_log("Falha no envio da mensagem de encerramento para $telefone. Código: $httpCode");
                }
            }

            echo json_encode(['status' => 'ok']);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log("Erro finalização: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        exit;
    }

    // ---------- PRÓXIMO DA FILA ----------
    if ($_GET['action'] === 'proximo') {
        try {
            $setorId = isset($_GET['setor_id']) ? (int)$_GET['setor_id'] : null;
            if (!$setorId) {
                $stmt = $pdo->prepare("
                    SELECT DISTINCT a.setor_id
                    FROM atendimentos a
                    INNER JOIN atendente_setor s ON s.setor_id = a.setor_id
                    WHERE a.status = 'fila' AND s.atendente_id = ?
                    LIMIT 1
                ");
                $stmt->execute([$_SESSION['atendente_id']]);
                $row = $stmt->fetch();
                if (!$row) {
                    echo json_encode(['status' => 'info', 'message' => 'Nenhum atendimento na fila']);
                    exit;
                }
                $setorId = $row['setor_id'];
            }

            $novoId = Atendimento::pegarProximoDaFila($setorId, $_SESSION['atendente_id']);
            if ($novoId) {
                echo json_encode(['status' => 'ok', 'atendimento_id' => $novoId]);
            } else {
                echo json_encode(['status' => 'info', 'message' => 'Nenhum atendimento na fila']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        exit;
    }

    // Ação não reconhecida
    http_response_code(400);
    echo json_encode(['erro' => 'Ação inválida']);
    exit;
}
