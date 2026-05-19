<?php
class Setor
{
    public static function listarAtivos()
    {
        $pdo = Database::getConn();
        $stmt = $pdo->query("SELECT * FROM setores WHERE status = 'ativo' ORDER BY id");
        return $stmt->fetchAll();
    }
}
