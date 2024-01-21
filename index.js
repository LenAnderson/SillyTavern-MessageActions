import { chat, eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { executeSlashCommands, registerSlashCommand } from '../../../slash-commands.js';
import { delay } from '../../../utils.js';
import { quickReplyApi } from '../../quick-reply/index.js';




let settings;
const qrsList = [];
let qrsListJson;




const qrUpdate = async() => {
    while (true) {
        const setList = settings.quickReplySetList.map(name=>quickReplyApi.getSetByName(name)).filter(it=>it);
        const setListJson = JSON.stringify(setList);
        if (setListJson != qrsListJson) {
            while (qrsList.length > 0) qrsList.pop();
            qrsList.push(...setList);
            qrsListJson = setListJson;
            Array.from(document.querySelectorAll('#chat > .mes[mesid]')).forEach(it=>updateMessage(it.getAttribute('mesid'), true));
        }
        await delay(200);
    }
};


const applyRule = (a, b, rule) => {
    try {
        return ({
            'eq': ()=>a == b,
            'neq': ()=>a != b,
            'lt': ()=>a < b,
            'lte': ()=>a <= b,
            'gt': ()=>a > b,
            'gte': ()=>a >= b,
            'in': ()=>b.includes(a),
            'nin': ()=>!b.includes(a),
        })[rule]();
    } catch {
        return false;
    }
};

const returnObject = (context, path) => {
    const parts = path.split('::');
    let current = context;
    for (const part of parts) {
        let [_, key, func, subkey, rule, val, mapFunc, mapKey] = part.match(/^(.+?)(?:\((find|filter|findIndex)\s+([a-z0-9_]+)\s+(eq|lt|gt|neq|lte|gte|in|nin)\s+([^\)]*)\))?(?:\((map)\s+([a-z0-9_]+)\))?$/i);
        current = current[key];
        if (![func, subkey, rule, val].includes(undefined)) {
            try { val = JSON.parse(val); } catch {}
            switch (func) {
                case 'find': {
                    current = current.find(it=>applyRule(it[subkey], val, rule));
                    break;
                }
                case 'filter': {
                    current = current.filter(it=>applyRule(it[subkey], val, rule));
                    break;
                }
                case 'findIndex': {
                    current = current.findIndex(it=>applyRule(it[subkey], val, rule));
                    break;
                }
                default: {
                    break;
                }
            }
        }
        if (![mapFunc, mapKey].includes(undefined)) {
            switch (mapFunc) {
                case 'map': {
                    current = current.map(it=>it[mapKey]);
                    break;
                }
                default: {
                    break;
                }
            }
        }
        if (current === undefined || current === null) {
            break;
        }
    }
    if (typeof current == 'object') {
        return JSON.stringify(current);
    }
    return current ?? '';
};




const updateMessage = (mesIdx, isForced = false) => {
    if (!settings.isEnabled) return;
    const container = document.querySelector(`#chat > .mes[mesid="${mesIdx}"] .extraMesButtons`);
    if (!isForced && container.querySelector('.stma--button')) return;
    Array.from(container.querySelectorAll('.stma--button')).forEach(it=>it.remove());
    for (const qrs of qrsList) {
        for (const qr of qrs.qrList) {
            const btn = document.createElement('div'); {
                btn.classList.add('stma--button');
                btn.textContent = qr.label;
                btn.title = qr.title || qr.message;
                btn.addEventListener('click', async(evt)=>{
                    if (evt.ctrlKey) {
                        qr.showEditor();
                        return;
                    }
                    try {
                        const mes = chat[mesIdx];
                        const cmd = qr.message
                            .replace(/{{mes::id}}/ig, mesIdx)
                            .replace(/{{mes::((?:(?!(?:}})).)+)}}/ig, (_, path)=>returnObject(mes, path))
                        ;
                        await executeSlashCommands(cmd);
                    } catch (ex) {
                        toastr.error(ex);
                    }
                });
                container.firstElementChild.insertAdjacentElement('beforebegin', btn);
            }
        }
    }
};

const onMessageRendered = (mesIdx) => {
    updateMessage(mesIdx);
};


const initSettings = () => {
    settings = Object.assign({
        isEnabled: true,
        quickReplySetList: ['mbtest'],
    }, extension_settings.messageButtons ?? {});
    extension_settings.messageButtons = settings;
    qrUpdate();
};




const init = async () => {
    initSettings();

    registerSlashCommand('messageactions', (args, value)=>{
        try { value = JSON.parse(value); } catch {
            try { value = JSON.parse(`[${value}]`); } catch {
                try { value = value.split(/\s*,\s*/); } catch {
                    try { value = JSON.parse(`["${value}"]`); } catch { /* empty */ }
                }
            }
        }
        if (Array.isArray(value)) {
            settings.quickReplySetList = value;
            saveSettingsDebounced();
        }
    }, [], '<span class="monospace">listOfQrSetNames</span> – Set which QR sets to be used in messages buttons. Call without arguments to remove all QR sets. Example: <tt>/messageactions MyQrSet</tt> or <tt>/messageactions MyQrSet, MyOtherQrSet</tt> or <tt>/messageactions "MyQrSet", "My Other QR Set"</tt>', true, true);
};
await init();

eventSource.on(event_types.USER_MESSAGE_RENDERED, (mesIdx)=>onMessageRendered(mesIdx));
eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesIdx)=>onMessageRendered(mesIdx));

eventSource.on(event_types.CHAT_CHANGED, (chatId)=>{
    if (!chatId) return;
    Array.from(document.querySelectorAll('#chat > .mes[mesid]')).forEach(it=>updateMessage(it.getAttribute('mesid')));
});
