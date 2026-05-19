<?php
class Cliente
{
    public static function findOrCreate($telefone, $nome = null)
    {
        $pdo = Database::getConn();

        // Busca cliente pelo telefone
        $stmt = $pdo->prepare("SELECT * FROM clientes WHERE telefone = ?");
        $stmt->execute([$telefone]);
        $cliente = $stmt->fetch();

        if ($cliente) {
            // Cliente já existe: verifica se o nome está vazio ou diferente e atualiza
            if (!empty($nome) && (empty($cliente['nome']) || $cliente['nome'] !== $nome)) {
                $stmtUp = $pdo->prepare("UPDATE clientes SET nome = ? WHERE id = ?");
                $stmtUp->execute([$nome, $cliente['id']]);
                $cliente['nome'] = $nome; // Atualiza o array retornado
                // Log opcional
                error_log("Cliente {$cliente['id']} atualizado com nome: $nome");
            }
            return $cliente;
        } else {
            // Cliente novo: insere com nome (pode ser null)
            $stmtIns = $pdo->prepare("INSERT INTO clientes (telefone, nome) VALUES (?, ?)");
            $stmtIns->execute([$telefone, $nome]);
            $id = $pdo->lastInsertId();
            return ['id' => $id, 'telefone' => $telefone, 'nome' => $nome];
        }
    }
}
