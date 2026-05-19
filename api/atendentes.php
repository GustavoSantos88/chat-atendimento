<?php
session_start();
require_once '../classes/Database.php';
header('Content-Type: application/json');

if (!isset($_SESSION['atendente_id'])) {
    http_response_code(403);
    echo json_encode(['erro' => 'Não autenticado']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$pdo = Database::getConn();

// ---------- GET ----------
if ($method === 'GET' && isset($_GET['action'])) {
    if ($_GET['action'] === 'listar_por_setor' && isset($_GET['setor_id'])) {
        $setorId = (int)$_GET['setor_id'];
        $atualId = (int)$_SESSION['atendente_id'];
        $stmt = $pdo->prepare("
            SELECT a.id, a.nome
            FROM atendentes a
            INNER JOIN atendente_setor s ON s.atendente_id = a.id
            WHERE s.setor_id = ? AND a.id != ? AND a.ativo = 1
            ORDER BY a.nome
        ");
        $stmt->execute([$setorId, $atualId]);
        $lista = $stmt->fetchAll();
        echo json_encode($lista);
        exit;
    }
}

// ---------- PUT (alterar status) ----------
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $status = $data['status'] ?? null;
    if (!in_array($status, ['online', 'offline', 'pausa'])) {
        http_response_code(400);
        echo json_encode(['erro' => 'Status inválido']);
        exit;
    }
    $stmt = $pdo->prepare("UPDATE atendentes SET status = ? WHERE id = ?");
    $stmt->execute([$status, $_SESSION['atendente_id']]);
    echo json_encode(['status' => 'ok']);
    exit;
}

http_response_code(400);
echo json_encode(['erro' => 'Requisição inválida']);
