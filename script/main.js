let equipData = [];
let wisdomTable = [];

const EQUIP_PARTS = [
    { key: 'weapon', label: '武器' },
    { key: 'sub', label: '補助武器' },
    { key: 'neck', label: '首' },
    { key: 'head', label: '頭' },
    { key: 'ear_cloak', label: '耳/背' },
    { key: 'waist', label: '腰' },
    { key: 'hand', label: '手' },
    { key: 'armor', label: '鎧' },
    { key: 'leg', label: '足' }
];
for(let i=1; i<=10; i++) EQUIP_PARTS.push({ key: `finger${i}`, label: `指${i}` });

const ATTRS = [
    { key: 'fire', label: '火', color: '#ff6b6b' },
    { key: 'water', label: '水', color: '#73c2ff' },
    { key: 'wind', label: '風', color: '#6bf5a4' },
    { key: 'earth', label: '土', color: '#e6c273' },
    { key: 'light', label: '光', color: '#fffcbd' },
    { key: 'dark', label: '闇', color: '#d09eff' }
];

const FIELD_DEBUFFS = {
    "none": { fire: 0, water: 0, wind: 0, earth: 0, light: 0, dark: 0 },
    "subain": { fire: 45, water: 45, wind: 45, earth: 45, light: 45, dark: 45 },
    "elberg": { fire: 75, water: 75, wind: 75, earth: 35, light: 80, dark: 40 },
    "defhills": { fire: 50, water: 90, wind: 80, earth: 55, light: 50, dark: 50 },
    "babel": { fire: 85, water: 85, wind: 55, earth: 35, light: 60, dark: 60 },
    "nadara": { fire: 50, water: 60, wind: 70, earth: 70, light: 50, dark: 50 }
};

async function init() {
    try {
        const [equipRes, wisRes] = await Promise.all([
            fetch('./json/EQUIP_DATA.json'),
            fetch('./json/WISDOM_TABLE.json')
        ]);
        equipData = await equipRes.json();
        wisdomTable = await wisRes.json();
        
        buildEquipUI();
        loadSettings(); 
        attachEvents();
        calculate();
    } catch (e) {
        console.error("エラー:", e);
    }
}

function buildEquipUI() {
    const container = document.getElementById('equip_container');
    container.innerHTML = ''; // 一旦クリア

    EQUIP_PARTS.forEach(part => {
        const targetPart = part.key.startsWith('finger') ? 'finger' : part.key;
        const items = equipData.filter(item => item.part === targetPart);

        const wrapper = document.createElement('div');
        wrapper.className = 'flex-row';
        
        // ★ ここを完全に書き換え。labelとinput以外は入れない。
        wrapper.innerHTML = `
            <label style="width:65px;">${part.label}</label>
            <input list="dl_${targetPart}" id="val_${part.key}" placeholder="装備を選択..." class="equip-input">
        `;
        container.appendChild(wrapper);

        // 武器の右側を空けて2列目から防具を開始
        if (part.key === 'weapon') {
            const spacer = document.createElement('div');
            container.appendChild(spacer);
        }

        if (!document.getElementById(`dl_${targetPart}`)) {
            const dl = document.createElement('datalist');
            dl.id = `dl_${targetPart}`;
            items.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.name;
                dl.appendChild(opt);
            });
            document.body.appendChild(dl);
        }
    });
}

function attachEvents() {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(el => el.addEventListener('input', calculate));
    inputs.forEach(el => el.addEventListener('change', calculate));
}

function saveSettings() {
    const settings = {
        wisdom: document.getElementById('input_wisdom').value,
        otherBonus: document.getElementById('input_other_bonus').value,
        field: document.getElementById('input_field').value,
        fixedDebuff: document.getElementById('input_fixed_debuff').value,
        weaken: document.getElementById('input_weaken').value,
        pets: {},
        equips: {},
        rensei: {}
    };

    document.querySelectorAll('.pet-check').forEach(chk => {
        const skill = chk.value;
        const petId = chk.getAttribute('data-pet');
        const id = `${skill}_${petId}`;
        settings.pets[id] = chk.checked;
        settings.pets[`${id}_base`] = document.getElementById(`lv_${id}_base`).value;
        settings.pets[`${id}_bonus`] = document.getElementById(`lv_${id}_bonus`).value;
    });

    EQUIP_PARTS.forEach(part => {
        const input = document.getElementById(`val_${part.key}`);
        if (input) settings.equips[part.key] = input.value;
    });

    // 新しい下部の錬成OP
    ['all','fire','water','wind','earth','light','dark'].forEach(key => {
        const el = document.getElementById(`rensei_${key}`);
        if(el) settings.rensei[key] = el.value;
    });

    localStorage.setItem('rs_resist_sim_data', JSON.stringify(settings));
}

function loadSettings() {
    const savedData = localStorage.getItem('rs_resist_sim_data');
    if (!savedData) return;

    try {
        const s = JSON.parse(savedData);
        if (s.wisdom !== undefined) document.getElementById('input_wisdom').value = s.wisdom;
        if (s.otherBonus !== undefined) document.getElementById('input_other_bonus').value = s.otherBonus;
        if (s.field !== undefined) document.getElementById('input_field').value = s.field;
        if (s.fixedDebuff !== undefined) document.getElementById('input_fixed_debuff').value = s.fixedDebuff;
        if (s.weaken !== undefined) document.getElementById('input_weaken').value = s.weaken;

        if (s.pets) {
            document.querySelectorAll('.pet-check').forEach(chk => {
                const skill = chk.value;
                const petId = chk.getAttribute('data-pet');
                const id = `${skill}_${petId}`;
                if (s.pets[id] !== undefined) chk.checked = s.pets[id];
                const b = document.getElementById(`lv_${id}_base`);
                const bn = document.getElementById(`lv_${id}_bonus`);
                if (b && s.pets[`${id}_base`]) b.value = s.pets[`${id}_base`];
                if (bn && s.pets[`${id}_bonus`]) bn.value = s.pets[`${id}_bonus`];
            });
        }

        if (s.equips) {
            EQUIP_PARTS.forEach(p => {
                const el = document.getElementById(`val_${p.key}`);
                if (el && s.equips[p.key]) el.value = s.equips[p.key];
            });
        }

        if (s.rensei) {
            ['all','fire','water','wind','earth','light','dark'].forEach(k => {
                const el = document.getElementById(`rensei_${k}`);
                if (el && s.rensei[k] !== undefined) el.value = s.rensei[k];
            });
        }
    } catch (e) { console.error(e); }
}

function getWisdomBonus(wis) {
    const row = wisdomTable.find(r => wis >= r.min && wis <= r.max);
    return row ? row.bonus : (wis > 15359 ? 606 : 0);
}

function getPetBonuses() {
    let allRes = 0;
    let penReduc = { fire: 0, water: 0, wind: 0, earth: 0, light: 0, dark: 0 };
    const checkedPets = document.querySelectorAll('.pet-check:checked');
    checkedPets.forEach(chk => {
        const skill = chk.value;
        const petId = chk.getAttribute('data-pet');
        let lv = (parseInt(document.getElementById(`lv_${skill}_${petId}_base`).value)||1) + (parseInt(document.getElementById(`lv_${skill}_${petId}_bonus`).value)||1);
        if (lv > 9) lv = 9;
        if (skill === 'embrace') allRes += 15 + (lv - 1) * 5;
        else {
            allRes += 7 + (lv - 1) * 2;
            const r = 70 + (lv - 1) * 20;
            if (skill === 'ruby') penReduc.fire += r;
            else if (skill === 'sapphire') penReduc.water += r;
            else if (skill === 'emerald') penReduc.wind += r;
            else if (skill === 'topaz') penReduc.earth += r;
            else if (skill === 'diamond') penReduc.light += r;
            else if (skill === 'onyx') penReduc.dark += r;
            else if (skill === 'crystal') { for (let k in penReduc) penReduc[k] += r; }
        }
    });
    return { allRes, penReduc };
}

function calculate() {
    let wis = Math.max(0, parseInt(document.getElementById('input_wisdom').value) || 0);
    const wisBonus = getWisdomBonus(wis);
    document.getElementById('disp_wis_bonus').innerText = wisBonus;

    let otherBonus = Math.max(0, parseInt(document.getElementById('input_other_bonus').value) || 0);
    const petEffects = getPetBonuses();
    const fieldObj = FIELD_DEBUFFS[document.getElementById('input_field').value] || FIELD_DEBUFFS["none"];
    
    let fixed = Math.min(90, Math.max(0, parseInt(document.getElementById('input_fixed_debuff').value) || 0));
    let weak = Math.min(240, Math.max(0, parseInt(document.getElementById('input_weaken').value) || 0));

    let rAll = Math.max(0, parseInt(document.getElementById('rensei_all').value) || 0);

    const tbody = document.getElementById('result_tbody');
    tbody.innerHTML = '';

    ATTRS.forEach(attr => {
        let equipTotal = 0;
        EQUIP_PARTS.forEach(p => {
            const sel = equipData.find(i => i.name === document.getElementById(`val_${p.key}`).value);
            if (sel) equipTotal += sel[attr.key] || 0;
        });

        let rSpec = Math.max(0, parseInt(document.getElementById(`rensei_${attr.key}`).value) || 0);
        const baseTotal = equipTotal + wisBonus + otherBonus + petEffects.allRes + rAll + rSpec;

        let fDebuff = Math.max(0, fieldObj[attr.key] - petEffects.penReduc[attr.key]);
        let finalBase = baseTotal - fDebuff - fixed - weak;
        let finalResist = finalBase > 70 ? 70 : finalBase;

        let finalHtml = `<span class="val-final">${finalResist}%</span>`;
        if (finalBase > 70) finalHtml = `<span style="color:#888; font-size:0.85rem;">(${finalBase}%)</span><br>${finalHtml}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:${attr.color}">${attr.label}</td>
            <td>${baseTotal}%</td>
            <td><span style="color:#ff7675">-${fDebuff}%</span><br><span style="color:#ff7675">-${fixed}%</span></td>
            <td><span style="color:#e17055">-${weak}%</span></td>
            <td>${finalHtml}</td>
        `;
        tbody.appendChild(tr);
    });
    saveSettings();
}

init();