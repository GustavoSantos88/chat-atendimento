<?php
class Atendimento
{
    // Cria um novo atendimento (usado pelo webhook)
    public static function criar($clienteId, $setorId, $sessionId, $atendenteId = null)
    {
        $pdo = Database::getConn();
        $protocolo = 'AT' . date('Ymd') . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
        $status = $atendenteId ? 'aberto' : 'fila';
        $stmt = $pdo->prepare("INSERT INTO atendimentos (protocolo, cliente_id, setor_id, session_id, atendente_atual_id, status) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$protocolo, $clienteId, $setorId, $sessionId, $atendenteId, $status]);
        $atendimentoId = $pdo->lastInsertId();
        if ($atendenteId) {
            self::adicionarHistorico($atendimentoId, $atendenteId, 'principal');
        }
        return ['id' => $atendimentoId, 'protocolo' => $protocolo];
    }

    // Adiciona um registro de atendente ao histórico do atendimento
    public static function adicionarHistorico($atendimentoId, $atendenteId, $tipo = 'principal')
    {
        $pdo = Database::getConn();
        $stmt = $pdo->prepare("INSERT INTO atendimento_atendentes (atendimento_id, atendente_id, tipo) VALUES (?, ?, ?)");
        $stmt->execute([$atendimentoId, $atendenteId, $tipo]);
    }

    // Finaliza o atendimento
    public static function finalizar($atendimentoId)
    {
        $pdo = Database::getConn();
        $stmt = $pdo->prepare("UPDATE atendimentos SET status = 'finalizado', data_fechamento = NOW() WHERE id = ?");
        $stmt->execute([$atendimentoId]);
        // Finaliza o registro do atendente atual no histórico
        $stmt = $pdo->prepare("UPDATE atendimento_atendentes SET data_saida = NOW() WHERE atendimento_id = ? AND data_saida IS NULL");
        $stmt->execute([$atendimentoId]);

        $setorId = (int)$_SESSION['setor_atual'] ?? 0; // ou buscar do atendimento finalizado
        $proximoId = Atendimento::pegarProximoDaFila($setorId, $_SESSION['atendente_id']);
        if ($proximoId) {
            // Opcional: notificar via socket que um novo atendimento foi atribuído
        }
    }

    // Busca atendimento aberto por cliente e sessão
    public static function buscarAbertoPorCliente($telefone, $sessionId)
    {
        $pdo = Database::getConn();
        $sql = "SELECT a.* FROM atendimentos a
                INNER JOIN clientes c ON c.id = a.cliente_id
                WHERE c.telefone = ? AND a.session_id = ? AND a.status IN ('fila','aberto','transferido')
                LIMIT 1";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$telefone, $sessionId]);
        return $stmt->fetch();
    }

    // Busca atendimento por ID
    public static function buscarPorId($id)
    {
        $pdo = Database::getConn();
        $stmt = $pdo->prepare("SELECT a.*, c.nome as cliente_nome, c.telefone, s.nome as setor_nome 
                               FROM atendimentos a
                               LEFT JOIN clientes c ON a.cliente_id = c.id
                               LEFT JOIN setores s ON a.setor_id = s.id
                               WHERE a.id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    // Lista atendimentos ativos (fila/aberto) que o atendente pode atender (próprios ou da fila do setor)
    public static function listarAtivosPorAtendente($atendenteId)
    {
        $pdo = Database::getConn();
        $sql = "SELECT a.*, c.nome as cliente_nome, c.telefone, s.nome as setor_nome
            FROM atendimentos a
            LEFT JOIN clientes c ON a.cliente_id = c.id
            LEFT JOIN setores s ON a.setor_id = s.id
            WHERE a.status IN ('aberto', 'transferido') 
              AND a.atendente_atual_id = ?
            ORDER BY a.data_abertura ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$atendenteId]);
        return $stmt->fetchAll();
    }

    public static function pegarProximoDaFila($setorId, $atendenteId)
    {
        $pdo = Database::getConn();
        // Opcional: verificar se o atendente atende a este setor
        $stmt = $pdo->prepare("SELECT id FROM atendente_setor WHERE atendente_id = ? AND setor_id = ?");
        $stmt->execute([$atendenteId, $setorId]);
        if (!$stmt->fetch()) {
            return null; // Atendente não pertence a este setor
        }

        $pdo = Database::getConn();
        // Busca o atendimento mais antigo em fila deste setor
        $stmt = $pdo->prepare("SELECT id FROM atendimentos WHERE setor_id = ? AND status = 'fila' ORDER BY data_abertura ASC LIMIT 1");
        $stmt->execute([$setorId]);
        $atendimento = $stmt->fetch();
        if (!$atendimento) return null;

        $id = $atendimento['id'];
        // Atribui ao atendente
        $stmt = $pdo->prepare("UPDATE atendimentos SET status = 'aberto', atendente_atual_id = ? WHERE id = ?");
        $stmt->execute([$atendenteId, $id]);
        self::adicionarHistorico($id, $atendenteId, 'principal');
        return $id;
    }

    // Transferir atendimento para outro atendente
    public static function transferir($atendimentoId, $novoAtendenteId, $atendenteOrigemId = null)
    {
        $pdo = Database::getConn();
        // Atualiza o atendente atual e muda status para 'transferido' (ou mantém 'aberto'? O status 'transferido' é usado para indicar que houve transferência)
        $stmt = $pdo->prepare("UPDATE atendimentos SET atendente_atual_id = ?, status = 'transferido' WHERE id = ?");
        $stmt->execute([$novoAtendenteId, $atendimentoId]);

        // Registra a saída do atendente anterior (se fornecido)
        if ($atendenteOrigemId) {
            $stmt = $pdo->prepare("UPDATE atendimento_atendentes SET data_saida = NOW() WHERE atendimento_id = ? AND atendente_id = ? AND data_saida IS NULL");
            $stmt->execute([$atendimentoId, $atendenteOrigemId]);
        } else {
            // Caso não informado, finaliza o registro atual (onde data_saida é NULL)
            $stmt = $pdo->prepare("UPDATE atendimento_atendentes SET data_saida = NOW() WHERE atendimento_id = ? AND data_saida IS NULL");
            $stmt->execute([$atendimentoId]);
        }

        // Adiciona o novo atendente ao histórico
        self::adicionarHistorico($atendimentoId, $novoAtendenteId, 'transferencia');

        return true;
    }

    // Reabrir um atendimento (caso necessário)
    public static function reabrir($atendimentoId, $atendenteId)
    {
        $pdo = Database::getConn();
        $stmt = $pdo->prepare("UPDATE atendimentos SET status = 'aberto', atendente_atual_id = ?, data_fechamento = NULL WHERE id = ?");
        $stmt->execute([$atendenteId, $atendimentoId]);
        self::adicionarHistorico($atendimentoId, $atendenteId, 'principal');
        return true;
    }
}
