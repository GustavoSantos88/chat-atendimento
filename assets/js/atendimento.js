// /assets/js/atendimento.js
const atendimentoId = window.atendenteId;
const socket = io(window.socketUrl || 'http://localhost:3000', { transports: ['websocket', 'polling'] });
socket.emit('joinAtendimento', atendimentoId);

function carregarMensagens() {
    fetch(`${window.baseUrl}api/mensagens.php?atendimento_id=${atendimentoId}`)
        .then(response => response.json())
        .then(data => {
            let html = '';
            if (!Array.isArray(data) || data.length === 0) {
                html = '<div class="text-muted text-center">Nenhuma mensagem ainda</div>';
            } else {
                data.forEach(msg => {
                    if (msg.remetente_tipo === 'sistema') {
                        let texto = msg.mensagem || '';
                        let mensagemTexto = formatarMensagem(texto);
                        html += `<div class="system-message">${mensagemTexto}</div>`;
                    } else {
                        const classe = msg.remetente_tipo === 'cliente' ? 'received' : 'sent';
                        let texto = msg.mensagem || '';
                        let mensagemTexto = formatarMensagem(texto);
                        let dataEnvio = msg.data_envio ? new Date(msg.data_envio).toLocaleString() : 'data não disponível';
                        html += `
                            <div class="message ${classe}">
                                <div class="bubble">${mensagemTexto}</div>
                                <div class="small text-muted">${dataEnvio}</div>
                            </div>
                        `;
                    }
                });
            }
            document.getElementById('chat-box').innerHTML = html;
            document.getElementById('chat-box').scrollTop = document.getElementById('chat-box').scrollHeight;
        })
        .catch(() => toast('Erro ao carregar mensagens', 'error'));
}

function formatarMensagem(texto) {
    if (!texto) return '';
    let msg = escapeHtml(texto);
    msg = msg.replace(/\n/g, '<br>');
    msg = msg.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    return msg;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function enviarMsg() {
    const msg = document.getElementById('msgInput').value;
    if (!msg) {
        toast('Digite uma mensagem', 'info');
        return;
    }
    fetchWithToast(
        `${window.baseUrl}api/mensagens.php`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                atendimento_id: atendimentoId,
                mensagem: msg,
                session_id: window.sessionId,
                telefone: window.telefoneCliente
            })
        },
        'Mensagem enviada',
        'Erro ao enviar mensagem'
    ).then(() => {
        document.getElementById('msgInput').value = '';
        carregarMensagens();
    });
}

function transferir() {
    if (!window.setorId) {
        toast('Setor não identificado', 'error');
        return;
    }

    fetch(`${window.baseUrl}api/atendentes.php?action=listar_por_setor&setor_id=${window.setorId}`)
        .then(response => response.json())
        .then(atendentes => {
            if (atendentes.length === 0) {
                toast('Nenhum outro atendente disponível neste setor', 'info');
                return;
            }
            let modalHtml = `
                <div class="modal fade" id="transferModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Transferir atendimento</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p>Escolha o atendente para transferir:</p>
                                <div class="list-group" id="listaAtendentes">
            `;
            atendentes.forEach(a => {
                modalHtml += `<button type="button" class="list-group-item list-group-item-action" data-id="${a.id}">${escapeHtml(a.nome)}</button>`;
            });
            modalHtml += `
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            if (document.getElementById('transferModal')) document.getElementById('transferModal').remove();
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('transferModal'));
            modal.show();
            document.querySelectorAll('#listaAtendentes button').forEach(btn => {
                btn.addEventListener('click', function () {
                    const novoId = this.getAttribute('data-id');
                    modal.hide();
                    fetchWithToast(
                        `${window.baseUrl}api/atendimentos.php?action=transferir`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ atendimento_id: atendimentoId, atendente_id: novoId })
                        },
                        'Transferência realizada',
                        'Falha na transferência'
                    ).then(() => {
                        setTimeout(() => location.reload(), 1000);
                    });
                });
            });
        })
        .catch(() => toast('Erro ao carregar lista de atendentes', 'error'));
}

function finalizar() {
    if (!confirm('Finalizar atendimento?')) return;
    fetchWithToast(
        `${window.baseUrl}api/atendimentos.php?action=finalizar`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ atendimento_id: atendimentoId })
        },
        'Atendimento finalizado',
        'Erro ao finalizar'
    ).then(() => {
        return fetchWithToast(
            `${window.baseUrl}api/atendimentos.php?action=proximo`,
            { method: 'GET' },
            'Próximo atendimento atribuído',
            'Nenhum atendimento na fila'
        );
    }).then(() => {
        setTimeout(() => {
            window.location.reload();
        }, 800);
    }).catch(() => {
        window.location.reload();
    });
}

socket.on('novaMensagem', (data) => {
    if (data.atendimento_id == atendimentoId) {
        toast('Nova mensagem do cliente', 'info');
        carregarMensagens();
    }
});

setInterval(() => {
    if (atendimentoId && document.getElementById('chat-box')) {
        carregarMensagens();
    }
}, 5000);

carregarMensagens();

document.getElementById('msgInput').addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        enviarMsg();
    }
});