let equipData = [];
let wisdomTable = [];

const EQUIP_PARTS = [
    { key: 'weapon', label: '武器' }, { key: 'sub', label: '補助武器' }, { key: 'neck', label: '首' },
    { key: 'head', label: '頭' }, { key: 'ear_cloak', label: '耳/背' }, { key: 'waist', label: '腰' },
    { key: 'hand', label: '手' }, { key: 'armor', label: '鎧' }, { key: 'leg', label: '足' }
];
for(let i=1; i<=10; i++) EQUIP_PARTS.push({ key: `ring${i}`, label: `指${i}` });

const ATTRS = [
    { key: 'fire', label: '火', color: '#ff6b6b' }, { key: 'water', label: '水', color: '#73c2ff' },
    { key: 'wind', label: '風', color: '#6bf5a4' }, { key: 'earth', label: '土', color: '#e6c273' },
    { key: 'light', label: '光', color: '#fffcbd' }, { key: 'dark', label: '闇', color: '#d09eff' }
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
            fetch('./json/EQUIP_DATA.json'), fetch('./json/WISDOM_TABLE.json')
        ]);
        equipData = await equipRes.json();
        wisdomTable = await wisRes.json();
        buildEquipUI(); loadSettings(); attachEvents(); calculate();
    } catch (e) { console.error("データ読み込みエラー:", e); }
}

function buildEquipUI() {
    const container = document.getElementById('equip_container');
    if (!container) return; // コンテナがない場合は処理を中断
    container.innerHTML = '';
    EQUIP_PARTS.forEach(part => {
        const targetPart = part.key.startsWith('ring') ? 'ring' : part.key;
        const items = equipData.filter(item => item.part === targetPart);
        const wrapper = document.createElement('div');
        wrapper.className = 'flex-row';
        wrapper.innerHTML = `<label style="width:75px;">${part.label}</label><input list="dl_${targetPart}" id="val_${part.key}" placeholder="装備を選択..." class="equip-input">`;
        container.appendChild(wrapper);
        if (part.key === 'weapon') container.appendChild(document.createElement('div'));
        if (!document.getElementById(`dl_${targetPart}`)) {
            const dl = document.createElement('datalist'); dl.id = `dl_${targetPart}`;
            items.forEach(item => { const opt = document.createElement('option'); opt.value = item.name; dl.appendChild(opt); });
            document.body.appendChild(dl);
        }
    });
}

function attachEvents() {
    document.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', calculate); el.addEventListener('change', calculate);
    });
}

function saveSettings() {
    // 要素が存在しない場合(?.value)はエラーを出さず、デフォルト値(0やfalse)を設定する
    const s = {
        wisdom: document.getElementById('input_wisdom')?.value || "0",
        otherBonus: document.getElementById('input_other_bonus')?.value || "0",
        field: document.getElementById('input_field')?.value || "defhills",
        fixedDebuff: document.getElementById('input_fixed_debuff')?.value || "90",
        weaken: document.getElementById('input_weaken')?.value || "240",
        redstone: document.getElementById('check_redstone')?.checked || false,
        mb: document.getElementById('check_mb')?.checked || false,
        potential: document.getElementById('check_potential')?.checked || false,
        statue_all: document.getElementById('statue_all')?.value || "0",
        statue_all_pen: document.getElementById('statue_all_pen')?.value || "0",
        statues: {}, pets: {}, equips: {}, rensei: {}
    };
    ATTRS.forEach(a => {
        s.statues[a.key] = document.getElementById(`statue_${a.key}`)?.value || "0";
        s.rensei[a.key] = document.getElementById(`rensei_${a.key}`)?.value || "0";
    });
    s.rensei.all = document.getElementById('rensei_all')?.value || "0";
    
    document.querySelectorAll('.pet-check').forEach(chk => {
        const id = `${chk.value}_${chk.getAttribute('data-pet')}`;
        s.pets[id] = chk.checked;
        s.pets[`${id}_base`] = document.getElementById(`lv_${id}_base`)?.value || "5";
        s.pets[`${id}_bonus`] = document.getElementById(`lv_${id}_bonus`)?.value || "1";
    });
    
    EQUIP_PARTS.forEach(p => s.equips[p.key] = document.getElementById(`val_${p.key}`)?.value || "");
    localStorage.setItem('rs_resist_sim_data', JSON.stringify(s));
}

function loadSettings() {
    const data = localStorage.getItem('rs_resist_sim_data');
    if (!data) return;
    try {
        const s = JSON.parse(data);
        
        // 安全に値をセットするためのヘルパー関数
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

        setVal('input_wisdom', s.wisdom || 0);
        setVal('input_other_bonus', s.otherBonus || 0);
        setVal('input_field', s.field || "defhills");
        setVal('input_fixed_debuff', s.fixedDebuff || 90);
        setVal('input_weaken', s.weaken || 240);
        setChk('check_redstone', s.redstone);
        setChk('check_mb', s.mb);
        setChk('check_potential', s.potential);
        setVal('statue_all', s.statue_all || 0);
        setVal('statue_all_pen', s.statue_all_pen || 0);
        
        ATTRS.forEach(a => {
            if(s.statues && s.statues[a.key] !== undefined) setVal(`statue_${a.key}`, s.statues[a.key]);
            if(s.rensei && s.rensei[a.key] !== undefined) setVal(`rensei_${a.key}`, s.rensei[a.key]);
        });
        if(s.rensei && s.rensei.all !== undefined) setVal('rensei_all', s.rensei.all);
        
        if(s.pets) {
            document.querySelectorAll('.pet-check').forEach(chk => {
                const id = `${chk.value}_${chk.getAttribute('data-pet')}`;
                if(s.pets[id] !== undefined) chk.checked = !!s.pets[id];
                setVal(`lv_${id}_base`, s.pets[`${id}_base`] || 5);
                setVal(`lv_${id}_bonus`, s.pets[`${id}_bonus`] || 1);
            });
        }
        if(s.equips) EQUIP_PARTS.forEach(p => setVal(`val_${p.key}`, s.equips[p.key] || ""));
    } catch (e) { console.error("設定読み込みエラー:", e); }
}

function getWisdomBonus(wis) {
    const row = wisdomTable.find(r => wis >= r.min && wis <= r.max);
    return row ? row.bonus : (wis > 15359 ? 606 : 0);
}

function getPetBonuses() {
    let allRes = 0; let penReduc = { fire: 0, water: 0, wind: 0, earth: 0, light: 0, dark: 0 };
    document.querySelectorAll('.pet-check:checked').forEach(chk => {
        const skill = chk.value; const petId = chk.getAttribute('data-pet');
        // ?.value で要素が存在しない場合のエラーを防ぐ
        let lv = (parseInt(document.getElementById(`lv_${skill}_${petId}_base`)?.value)||1) + (parseInt(document.getElementById(`lv_${skill}_${petId}_bonus`)?.value)||1);
        if (lv > 9) lv = 9;
        if (skill === 'embrace') allRes += 15 + (lv - 1) * 5;
        else {
            allRes += 7 + (lv - 1) * 2; const r = 70 + (lv - 1) * 20;
            if (skill === 'ruby') penReduc.fire += r; else if (skill === 'sapphire') penReduc.water += r;
            else if (skill === 'emerald') penReduc.wind += r; else if (skill === 'topaz') penReduc.earth += r;
            else if (skill === 'diamond') penReduc.light += r; else if (skill === 'onyx') penReduc.dark += r;
            else if (skill === 'crystal') { for (let k in penReduc) penReduc[k] += r; }
        }
    });
    return { allRes, penReduc };
}

function calculate() {
    // 各項目の取得時、要素が見つからなければ0やデフォルト値にする
    let wis = Math.max(0, parseInt(document.getElementById('input_wisdom')?.value) || 0);
    const wisBonus = getWisdomBonus(wis);
    
    const dispWis = document.getElementById('disp_wis_bonus');
    if (dispWis) dispWis.innerText = wisBonus;

    const extraBonus = (document.getElementById('check_redstone')?.checked ? 5 : 0) 
                     + (document.getElementById('check_mb')?.checked ? 14 : 0) 
                     + (document.getElementById('check_potential')?.checked ? 10 : 0);
                     
    const statueAllRes = Math.min(5, Math.max(0, parseInt(document.getElementById('statue_all')?.value) || 0));
    const statueAllPen = Math.min(5, Math.max(0, parseInt(document.getElementById('statue_all_pen')?.value) || 0));
    const otherBonus = Math.max(0, parseInt(document.getElementById('input_other_bonus')?.value) || 0);
    
    const petEff = getPetBonuses();
    
    const fieldVal = document.getElementById('input_field')?.value || "defhills";
    const fieldObj = FIELD_DEBUFFS[fieldVal] || FIELD_DEBUFFS["none"];
    
    const fixed = Math.min(90, Math.max(0, parseInt(document.getElementById('input_fixed_debuff')?.value) || 0));
    const weak = Math.min(240, Math.max(0, parseInt(document.getElementById('input_weaken')?.value) || 0));
    const renAll = Math.max(0, parseInt(document.getElementById('rensei_all')?.value) || 0);

    const tbody = document.getElementById('result_tbody'); 
    if (!tbody) return; // tbodyが存在しない場合は計算処理を中断
    tbody.innerHTML = '';

    ATTRS.forEach(attr => {
        let equipTotal = 0;
        EQUIP_PARTS.forEach(p => {
            const valInput = document.getElementById(`val_${p.key}`);
            if (valInput) {
                const sel = equipData.find(i => i.name === valInput.value);
                if (sel) equipTotal += sel[attr.key] || 0;
            }
        });
        const statueSpecLv = Math.min(5, Math.max(0, parseInt(document.getElementById(`statue_${attr.key}`)?.value) || 0));
        const renSpec = Math.max(0, parseInt(document.getElementById(`rensei_${attr.key}`)?.value) || 0);

        const baseTotal = equipTotal + wisBonus + otherBonus + petEff.allRes + renAll + renSpec + extraBonus + statueAllRes + statueSpecLv;
        const totalPenReduc = petEff.penReduc[attr.key] + (statueSpecLv * 3) + (statueAllPen * 5);
        const finalFieldDebuff = Math.max(0, fieldObj[attr.key] - totalPenReduc);
        
        let finalBase = baseTotal - finalFieldDebuff - fixed - weak;
        let finalResist = finalBase > 70 ? 70 : finalBase;
        let finalHtml = `<span class="val-final">${finalResist}%</span>`;
        if (finalBase > 70) finalHtml = `<span style="color:#888; font-size:0.85rem;">(${finalBase}%)</span><br>${finalHtml}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="color:${attr.color}">${attr.label}</td><td>${baseTotal}%</td><td><span style="color:#ff7675">-${finalFieldDebuff}%</span> <span class="calc-sub">(ﾏｯﾌﾟ)</span><br><span style="color:#ff7675">-${fixed}%</span> <span class="calc-sub">(固定)</span></td><td><span style="color:#e17055">-${weak}%</span></td><td>${finalHtml}</td>`;
        tbody.appendChild(tr);
    });
    
    saveSettings(); // 計算の最後に保存
}

init();