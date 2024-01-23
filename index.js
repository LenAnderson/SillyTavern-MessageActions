import { chat, eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { executeSlashCommands, registerSlashCommand } from '../../../slash-commands.js';
import { delay } from '../../../utils.js';
import { quickReplyApi } from '../../quick-reply/index.js';




let settings;
const qrsList = [];
let qrsListJson;
const wiQrsList = [];
let wiQrsListJson;
let file;




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

        let wiForce = false;
        const wiSetList = settings.wiQuickReplySetList.map(name=>quickReplyApi.getSetByName(name)).filter(it=>it);
        const wiSetListJson = JSON.stringify(wiSetList);
        if (wiSetListJson != wiQrsListJson) {
            while (wiQrsList.length > 0) wiQrsList.pop();
            wiQrsList.push(...wiSetList);
            wiQrsListJson = wiSetListJson;
            wiForce = true;
        }
        const newFile = document.querySelector('#world_editor_select :checked').textContent;
        if (file != newFile) {
            file = newFile;
            wiForce = true;
        }
        Array.from(document.querySelectorAll('#world_popup_entries_list .world_entry')).forEach(entry=>{
            updateWiEntry(entry, wiForce);
        });
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



const updateWiEntry = (entry, isForced = false) => {
    if (!settings.isEnabled) return;
    if (!isForced && entry.querySelector('.stma--button')) return;
    Array.from(entry.querySelectorAll('.stma--button')).forEach(it=>it.remove());
    const anchor = entry.querySelector('.WIEntryTitleAndStatus [name="comment"]');
    for (const qrs of wiQrsList) {
        for (const qr of qrs.qrList) {
            const btn = document.createElement('div'); {
                btn.classList.add('stma--button');
                btn.classList.add('menu_button');
                btn.textContent = qr.label;
                btn.title = qr.title || qr.message;
                btn.addEventListener('click', async(evt)=>{
                    evt.stopPropagation();
                    if (evt.ctrlKey) {
                        qr.showEditor();
                        return;
                    }
                    try {
                        const wi = {
                            file: ()=>`"${file}"`,
                            id: ()=>entry.querySelector('.world_entry_form_uid_value').textContent.replace(/^.*?(\d+).*?$/, '$1'),
                            comment: ()=>anchor.value,
                            status: ()=>entry.querySelector('[name="entryStateSelector"]').value,
                            position: ()=>entry.querySelector('[name="position"]').value,
                            depth: ()=>entry.querySelector('[name="depth"]').value,
                            order: ()=>entry.querySelector('[name="order"]').value,
                            probability: ()=>entry.querySelector('[name="probability"]').value,
                            key: ()=>entry.querySelector('[name="key"]').value,
                            entryLogicType: ()=>entry.querySelector('[name="entryLogicType"]').value,
                            keysecondary: ()=>entry.querySelector('[name="keysecondary"]').value,
                            exclude_recursion: ()=>entry.querySelector('[name="exclude_recursion"]').checked,
                            prevent_recursion: ()=>entry.querySelector('[name="prevent_recursion"]').checked,
                            content: ()=>entry.querySelector('[name="content"]').value,
                            character_exclusion: ()=>entry.querySelector('[name="character_exclusion"]').checked,
                            characterFilter: ()=>entry.querySelector('[name="characterFilter"]').value,
                            group: ()=>entry.querySelector('[name="group"]').value,
                        };
                        const cmd = qr.message
                            .replace(/{{wi::((?:(?!(?:}})).)+)}}/ig, (_, path)=>wi[path]())
                        ;
                        await executeSlashCommands(cmd);
                    } catch (ex) {
                        toastr.error(ex.message);
                    }
                });
                anchor.insertAdjacentElement('afterend', btn);
                anchor.parentElement.style.flexWrap = 'nowrap';
            }
        }
    }
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
                        const id = btn.closest('[mesid]').getAttribute('mesid');
                        const mes = chat[id];
                        const cmd = qr.message
                            .replace(/{{mes::id}}/ig, id)
                            .replace(/{{mes::((?:(?!(?:}})).)+)}}/ig, (_, path)=>returnObject(mes, path))
                        ;
                        await executeSlashCommands(cmd);
                    } catch (ex) {
                        toastr.error(ex.message);
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
        quickReplySetList: [],
        wiQuickReplySetList : [],
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


    registerSlashCommand('wiactions', (args, value)=>{
        try { value = JSON.parse(value); } catch {
            try { value = JSON.parse(`[${value}]`); } catch {
                try { value = value.split(/\s*,\s*/); } catch {
                    try { value = JSON.parse(`["${value}"]`); } catch { /* empty */ }
                }
            }
        }
        if (Array.isArray(value)) {
            settings.wiQuickReplySetList = value;
            saveSettingsDebounced();
        }
    }, [], '<span class="monospace">listOfQrSetNames</span> – Set which QR sets to be used in WI buttons. Call without arguments to remove all QR sets. Example: <tt>/wiactions MyQrSet</tt> or <tt>/wiactions MyQrSet, MyOtherQrSet</tt> or <tt>/wiactions "MyQrSet", "My Other QR Set"</tt>', true, true);

};
await init();

eventSource.on(event_types.USER_MESSAGE_RENDERED, (mesIdx)=>onMessageRendered(mesIdx));
eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesIdx)=>onMessageRendered(mesIdx));

eventSource.on(event_types.CHAT_CHANGED, (chatId)=>{
    if (!chatId) return;
    Array.from(document.querySelectorAll('#chat > .mes[mesid]')).forEach(it=>updateMessage(it.getAttribute('mesid')));
});
