const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.json());

io.on('connection', (socket) => {
    console.log('✅ Cliente conectado:', socket.id);
    socket.on('joinAtendente', (atendenteId) => {
        console.log(`Atendente ${atendenteId} entrou na sala`);
        socket.join(`atendente_${atendenteId}`);
    });
    socket.on('joinSetor', (setorId) => {
        socket.join(`setor_${setorId}`);
    });
    socket.on('joinAtendimento', (atendimentoId) => {
        socket.join(`atendimento_${atendimentoId}`);
    });
});

app.post('/emit', (req, res) => {
    const { event, data } = req.body;
    console.log('📡 Emitindo:', event, data);
    switch (event) {
        case 'novoAtendimento':
            io.to(`setor_${data.setor_id}`).emit('novoAtendimento', data.atendimento);
            break;
        case 'atendimentoTransferido':
            io.to(`atendimento_${data.atendimento_id}`).emit('atendimentoTransferido', data);
            break;
        case 'novaMensagem':
            io.to(`atendimento_${data.atendimento_id}`).emit('novaMensagem', data);
            break;
        case 'atendenteOnline':
            io.emit('atendenteOnline', data);
            break;
    }
    res.json({ ok: true });
});

http.listen(3000, '0.0.0.0', () => {
    console.log('🚀 Socket.IO rodando na porta 3000');
});