<?php
class Database
{
    private static $pdo = null;

    public static function getConn()
    {
        if (self::$pdo === null) {
            $host = 'localhost';
            $dbname = 'chat_whatsapp';
            $user = 'root';
            $pass = '1';
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
