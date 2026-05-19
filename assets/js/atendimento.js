// /assets/js/atendimento.js
const atendimentoId = window.atendimentoId;
const socket = io(window.socketUrl || 'http://localhost:3000', { transports: ['websocket', 'polling'] });
socket.emit('joinAtendimento', atendimentoId);

function carregarMensagens() {
    fetch(`${window.baseUrl}api/mensagens.php?atendimento_id=${atendimentoId}`)
        .then(response => response.json())
        .then(data => {
            let html = '';
            if (data.length === 0) {
                html = '<div class="text-muted text-center">Nenhuma mensagem ainda</div>';
            } else {
                data.forEach(msg => {
                    // const classe = msg.remetente_tipo === 'cliente' ? 'client' : 'atendente';
                    const classe = msg.remetente_tipo === 'cliente' ? 'received' : 'sent';
                    html += `<div class="message ${classe}"><div class="bubble">${escapeHtml(msg.mensagem)}</div><div class="small text-muted">${msg.data_envio}</div></div>`;
                });
            }
            document.getElementById('chat-box').innerHTML = html;
            document.getElementById('chat-box').scrollTop = document.getElementById('chat-box').scrollHeight;
        })
        .catch(() => toast('Erro ao carregar mensagens', 'error'));
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
        'api/mensagens.php',
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
            // Cria modal dinâmico
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
                modalHtml += `<button type="button" class="list-group-item list-group-item-action" data-id="${a.id}">${a.nome}</button>`;
            });
            modalHtml += `
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            // Remove modal existente (se houver)
            if (document.getElementById('transferModal')) document.getElementById('transferModal').remove();
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('transferModal'));
            modal.show();
            // Adiciona evento aos botões
            document.querySelectorAll('#listaAtendentes button').forEach(btn => {
                btn.addEventListener('click', function () {
                    const novoId = this.getAttribute('data-id');
                    modal.hide();
                    // Chama a transferência
                    fetchWithToast(
                        'api/atendimentos.php?action=transferir',
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
        'api/atendimentos.php?action=finalizar',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ atendimento_id: atendimentoId })
        },
        'Atendimento finalizado',
        'Erro ao finalizar'
    ).then(() => {
        return fetchWithToast(
            'api/atendimentos.php?action=proximo',
            { method: 'GET' },
            'Próximo atendimento atribuído',
            'Nenhum atendimento na fila'
        );
    }).then(() => {
        setTimeout(() => {
            window.location.href = window.baseUrl + 'views/dashboard.php';
        }, 800);
    }).catch(() => {
        window.location.href = window.baseUrl + 'views/dashboard.php';
    });
}

socket.on('novaMensagem', (data) => {
    if (data.atendimento_id == atendimentoId) {
        toast('Nova mensagem do cliente', 'info');
        carregarMensagens();
    }
});

// Fallback: recarregar mensagens automaticamente a cada 5 segundos
setInterval(() => {
    if (atendimentoId && document.getElementById('chat-box')) {
        carregarMensagens();
    }
}, 5000);

// carregarMensagens();

document.getElementById('msgInput').addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        enviarMsg();
    }
});