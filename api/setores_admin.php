<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['atendente_id']) || $_SESSION['atendente_id'] != 1) {
    http_response_code(403);
    echo json_encode(['erro' => 'Acesso negado']);
    exit;
}

require_once '../classes/Database.php';
$pdo = Database::getConn();
$method = $_SERVER['REQUEST_METHOD'];

// Listar setores (GET)
if ($method === 'GET') {
    $stmt = $pdo->prepare("SELECT id, nome, status FROM setores ORDER BY nome");
    $stmt->execute();
    echo json_encode($stmt->fetchAll());
    exit;
}

// Criar setor (POST)
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $nome = $data['nome'];
    $status = $data['status'] ?? 'ativo';
    $stmt = $pdo->prepare("INSERT INTO setores (nome, status) VALUES (?, ?)");
    $stmt->execute([$nome, $status]);
    echo json_encode(['status' => 'ok', 'id' => $pdo->lastInsertId()]);
    exit;
}

// Editar setor (PUT)
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'];
    $nome = $data['nome'];
    $status = $data['status'];
    $stmt = $pdo->prepare("UPDATE setores SET nome = ?, status = ? WHERE id = ?");
    $stmt->execute([$nome, $status, $id]);
    echo json_encode(['status' => 'ok']);
    exit;
}

// Excluir setor (DELETE)
if ($method === 'DELETE') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'];
    $stmt = $pdo->prepare("DELETE FROM setores WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['status' => 'ok']);
    exit;
}
