<?php
class Database {
    private static $pdo = null;

    public static function getConn() {
        if (self::$pdo === null) {
            $config = require_once __DIR__ . '/../config/database.php';
            // Se database.php retornar um array, use-o. Mas o original define variáveis.
            // Vamos redefinir manualmente:
            $host = 'localhost';
            $dbname = 'chat_whatsapp';
            $user = 'root';          // ajuste conforme seu MySQL
            $pass = '1';        // ajuste
            try {
                self::$pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
                self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                self::$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            } catch (PDOException $e) {
                error_log("Erro de conexão: " . $e->getMessage());
                return null;
            }
        }
        return self::$pdo;
    }
}
?>