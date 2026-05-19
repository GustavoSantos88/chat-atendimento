// /assets/js/utils.js
function fetchWithToast(url, options, successMsg, errorMsg) {
    const fullUrl = url.startsWith('http') ? url : (window.baseUrl || '/chat-atendimento/') + url;
    return fetch(fullUrl, options)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.status === 'ok') {
                if (successMsg) toast(successMsg, 'success');
            } else {
                toast(errorMsg || 'Erro na operação', 'error');
            }
            return data;
        })
        .catch(err => {
            toast(errorMsg || 'Falha de rede', 'error');
            throw err;
        });
}