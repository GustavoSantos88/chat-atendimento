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
    $atendimento_id = $_GET['atendimento_id'] ?? 0;
    if (!$atendimento_id) {
        http_response_code(400);
        echo json_encode(['erro' => 'atendimento_id é obrigatório']);
        exit;
    }

    $is_admin = ($_SESSION['atendente_id'] == 1);

    if (!$is_admin) {
        // Verifica se o atendimento pertence ao atendente logado
        $stmt = $pdo->prepare("SELECT atendente_atual_id FROM atendimentos WHERE id = ? ORDER BY data_envio ASC, created_at ASC");
        $stmt->execute([$atendimento_id]);
        $atend = $stmt->fetch();
        if (!$atend || $atend['atendente_atual_id'] != $_SESSION['atendente_id']) {
            http_response_code(403);
            echo json_encode(['erro' => 'Acesso negado']);
            exit;
        }
    }

    $stmt = $pdo->prepare("SELECT * FROM mensagens WHERE atendimento_id = ? ORDER BY data_envio ASC, created_at ASC");
    $stmt->execute([$atendimento_id]);
    $mensagens = $stmt->fetchAll();
    echo json_encode($mensagens);
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
        // Verifica se o atendimento pertence ao atendente
        $stmt = $pdo->prepare("SELECT atendente_atual_id FROM atendimentos WHERE id = ?");
        $stmt->execute([$atendimento_id]);
        $atend = $stmt->fetch();
        if (!$atend || $atend['atendente_atual_id'] != $_SESSION['atendente_id']) {
            http_response_code(403);
            echo json_encode(['erro' => 'Acesso negado']);
            exit;
        }
    }

    // Salvar mensagem do atendente    
    $msgId = Mensagem::salvar($atendimento_id, $session_id, 'atendente', 'saida', 'texto', $mensagem, null, date('Y-m-d H:i:s'), $_SESSION['atendente_nome']);

    $mensagem = "*" . $_SESSION['atendente_nome'] . ":*" . "\n\n" . trim($mensagem);

    // Enviar mensagem via API zapcloud
    $url = BASE_URL_API . 'api/send';
    $postData = [
        'sessionId' => $session_id,
        'number'    => $telefone,
        'message'   => $mensagem
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
