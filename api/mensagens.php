<?php
session_start();
require_once '../classes/Database.php';
require_once '../classes/Mensagem.php';
require_once '../config/app.php';

header('Content-Type: application/json');

if (!isset($_SESSION['atendente_id'])) {
    http_response_code(403);
    echo json_encode(['erro' => 'Não autenticado']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$pdo = Database::getConn();

if ($method === 'GET') {
    $cliente_id = isset($_GET['cliente_id']) ? (int)$_GET['cliente_id'] : 0;
    $atendimento_id = isset($_GET['atendimento_id']) ? (int)$_GET['atendimento_id'] : 0;

    if ($cliente_id > 0) {
        // $is_admin = ($_SESSION['atendente_id'] == 1);
        // if (!$is_admin) {
        //     // Atendente comum não tem permissão; retorna array vazio (evita erro 403 no console)
        //     echo json_encode([]);
        //     exit;
        // }

        // Ordem cronológica: mais antigo primeiro (ASC)
        $sql = "
            SELECT m.*, 
                   a.protocolo, 
                   a.id as atendimento_id, 
                   a.status as atendimento_status, 
                   a.data_abertura as atendimento_data_abertura,
                   a.data_fechamento as atendimento_data_fechamento,
                   a.setor_id
            FROM mensagens m
            JOIN atendimentos a ON m.atendimento_id = a.id
            WHERE a.cliente_id = ?
            ORDER BY a.data_abertura ASC, m.data_envio ASC, m.created_at ASC
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$cliente_id]);
        $mensagens = $stmt->fetchAll();
        echo json_encode($mensagens);
        exit;
    }

    if ($atendimento_id > 0) {
        $is_admin = ($_SESSION['atendente_id'] == 1);

        if (!$is_admin) {
            $stmt = $pdo->prepare("SELECT atendente_atual_id FROM atendimentos WHERE id = ?");
            $stmt->execute([$atendimento_id]);
            $atend = $stmt->fetch();
            if (!$atend) {
                http_response_code(404);
                echo json_encode(['erro' => 'Atendimento não encontrado']);
                exit;
            }
            if ($atend['atendente_atual_id'] != $_SESSION['atendente_id']) {
                error_log("Acesso negado para atendente {$_SESSION['atendente_id']} no atendimento $atendimento_id (atendente atual: {$atend['atendente_atual_id']})");
                http_response_code(403);
                echo json_encode(['erro' => 'Acesso negado: você não é o atendente atual deste atendimento']);
                exit;
            }
        }

        // Ordem cronológica dentro do atendimento: mais antiga primeiro
        $stmt = $pdo->prepare("SELECT * FROM mensagens WHERE atendimento_id = ? ORDER BY data_envio ASC, created_at ASC");
        $stmt->execute([$atendimento_id]);
        $mensagens = $stmt->fetchAll();
        echo json_encode($mensagens);
        exit;
    }

    http_response_code(400);
    echo json_encode(['erro' => 'Parâmetro obrigatório: atendimento_id ou cliente_id']);
    exit;
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['erro' => 'Dados inválidos']);
        exit;
    }

    $atendimento_id = $input['atendimento_id'];
    $mensagem = trim($input['mensagem']);
    $session_id = $input['session_id'];
    $telefone = $input['telefone'];

    if (!$atendimento_id || !$mensagem || !$session_id || !$telefone) {
        http_response_code(400);
        echo json_encode(['erro' => 'Parâmetros incompletos']);
        exit;
    }

    $is_admin = ($_SESSION['atendente_id'] == 1);

    if (!$is_admin) {
        $stmt = $pdo->prepare("SELECT atendente_atual_id FROM atendimentos WHERE id = ?");
        $stmt->execute([$atendimento_id]);
        $atend = $stmt->fetch();
        if (!$atend || $atend['atendente_atual_id'] != $_SESSION['atendente_id']) {
            http_response_code(403);
            echo json_encode(['erro' => 'Acesso negado']);
            exit;
        }
    }

    $msgId = Mensagem::salvar($atendimento_id, $session_id, 'atendente', 'saida', 'texto', $mensagem, null, date('Y-m-d H:i:s'), $_SESSION['atendente_nome']);
    $mensagem = "*" . $_SESSION['atendente_nome'] . ":*" . "\n\n" . trim($mensagem);

    $url = BASE_URL_API . 'api/send';
    $postData = ['sessionId' => $session_id, 'number' => $telefone, 'message' => $mensagem];
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'X-API-KEY: ' . API_KEY
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode == 200) {
        echo json_encode(['status' => 'ok', 'message_id' => $msgId]);
    } else {
        error_log("Falha ao enviar mensagem para $telefone: HTTP $httpCode - " . $response);
        echo json_encode(['status' => 'ok', 'message_id' => $msgId, 'warning' => 'Mensagem salva mas não enviada']);
    }
}
