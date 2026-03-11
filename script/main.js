/**
 * REDSTONE 属性抵抗シミュレーター - メインロジック
 * * 機能：
 * - 装備データの読み込みとUI生成
 * - 知恵、ペット、追加ボーナス、石像、錬成OPの合算
 * - フィールドペナルティの減少計算（石像・ペット対応）
 * - 設定のローカルストレージへの保存・復元
 */

let equipData = [];
let wisdomTable = [];

// 装備部位の定義
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
// 指は10枠追加
for(let i=1; i<=10; i++) EQUIP_PARTS.push({ key: `ring${i}`, label: `指${i}` });

// 属性の定義
const ATTRS = [
    { key: 'fire', label: '火', color: '#ff6b6b' },
    { key: 'water', label: '水', color: '#73c2ff' },
    { key: 'wind', label: '風', color: '#6bf5a4' },
    { key: 'earth', label: '土', color: '#e6c273' },
    { key: 'light', label: '光', color: '#fffcbd' },
    { key: 'dark', label: '闇', color: '#d09eff' }
];

// マップ別ペナルティ値
const FIELD_DEBUFFS = {
    "none": { fire: 0, water: 0, wind: 0, earth: 0, light: 0, dark: 0 },
    "subain": { fire: 45, water: 45, wind: 45, earth: 45, light: 45, dark: 45 },
    "elberg": { fire: 75, water: 75, wind: 75, earth: 35, light: 80, dark: 40 },
    "defhills": { fire: 50, water: 90, wind: 80, earth: 55, light: 50, dark: 50 },
    "babel": { fire: 85, water: 85, wind: 55, earth: 35, light: 60, dark: 60 },
    "nadara": { fire: 50, water: 60, wind: 70, earth: 70, light: 50, dark: 50 }
};

/**
 * 初期化処理
 */
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
        console.error("データの読み込みに失敗しました:", e);
    }
}

/**
 * 装備入力UIの動的生成
 */
function buildEquipUI() {
    const container = document.getElementById('equip_container');
    container.innerHTML = ''; 

    EQUIP_PARTS.forEach(part => {
        const targetPart = part.key.startsWith('ring') ? 'ring' : part.key;
        const items = equipData.filter(item => item.part === targetPart);

        const wrapper = document.createElement('div');
        wrapper.className = 'flex-row';
        wrapper.innerHTML = `
            <label style="width:75px;">${part.label}</label>
            <input list="dl_${targetPart}" id="val_${part.key}" placeholder="装備を選択..." class="equip-input">
        `;
        container.appendChild(wrapper);

        // 武器の右側を空けてレイアウトを整える
        if (part.key === 'weapon') {
            const spacer = document.createElement('div');
            container.appendChild(spacer);
        }

        // datalistの生成（未作成の場合のみ）
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

/**
 * イベントリスナーの登録
 */
function attachEvents() {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(el => {
        el.addEventListener('input', calculate);
        el.addEventListener('change', calculate);
    });
}

/**
 * 現在の状態を保存
 */
function saveSettings() {
    const settings = {
        wisdom: document.getElementById('input_wisdom').value,
        otherBonus: document.getElementById('input_other_bonus').value,
        field: document.getElementById('input_field').value,
        fixedDebuff: document.getElementById('input_fixed_debuff').value,
        weaken: document.getElementById('input_weaken').value,
        // 追加ボーナス
        redstone: document.getElementById('check_redstone').checked,
        mb: document.getElementById('check_mb').checked,
        potential: document.getElementById('check_potential').checked,
        // 石像
        statue_all: document.getElementById('statue_all').value,
        statue_all_pen: document.getElementById('statue_all_pen').value,
        statues: {},
        pets: {},
        equips: {},
        rensei: {}
    };

    // 石像個別
    ATTRS.forEach(attr => {
        settings.statues[attr.key] = document.getElementById(`statue_${attr.key}`).value;
        const renseiEl = document.getElementById(`rensei_${attr.key}`);
        if(renseiEl) settings.rensei[attr.key] = renseiEl.value;
    });
    settings.rensei.all = document.getElementById('rensei_all').value;

    // ミニペット
    document.querySelectorAll('.pet-check').forEach(chk => {
        const skill = chk.value;
        const petId = chk.getAttribute('data-pet');
        const id = `${skill}_${petId}`;
        settings.pets[id] = chk.checked;
        settings.pets[`${id}_base`] = document.getElementById(`lv_${id}_base`).value;
        settings.pets[`${id}_bonus`] = document.getElementById(`lv_${id}_bonus`).value;
    });

    // 装備
    EQUIP_PARTS.forEach(part => {
        const input = document.getElementById(`val_${part.key}`);
        if (input) settings.equips[part.key] = input.value;
    });

    localStorage.setItem('rs_resist_sim_data', JSON.stringify(settings));
}

/**
 * 保存された状態を復元
 */
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

        // 追加ボーナス
        if (s.redstone !== undefined) document.getElementById('check_redstone').checked = s.redstone;
        if (s.mb !== undefined) document.getElementById('check_mb').checked = s.mb;
        if (s.potential !== undefined) document.getElementById('check_potential').checked = s.potential;

        // 石像
        if (s.statue_all !== undefined) document.getElementById('statue_all').value = s.statue_all;
        if (s.statue_all_pen !== undefined) document.getElementById('statue_all_pen').value = s.statue_all_pen;
        if (s.statues) {
            ATTRS.forEach(attr => {
                const el = document.getElementById(`statue_${attr.key}`);
                if (el && s.statues[attr.key] !== undefined) el.value = s.statues[attr.key];
            });
        }

        // 錬成OP
        if (s.rensei) {
            if (s.rensei.all !== undefined) document.getElementById('rensei_all').value = s.rensei.all;
            ATTRS.forEach(attr => {
                const el = document.getElementById(`rensei_${attr.key}`);
                if (el && s.rensei[attr.key] !== undefined) el.value = s.rensei[attr.key];
            });
        }

        // ミニペット
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

        // 装備
        if (s.equips) {
            EQUIP_PARTS.forEach(p => {
                const el = document.getElementById(`val_${p.key}`);
                if (el && s.equips[p.key]) el.value = s.equips[p.key];
            });
        }
    } catch (e) { console.error("設定の復元に失敗しました:", e); }
}

/**
 * 知恵ボーナスの取得
 */
function getWisdomBonus(wis) {
    const row = wisdomTable.find(r => wis >= r.min && wis <= r.max);
    return row ? row.bonus : (wis > 15359 ? 606 : 0);
}

/**
 * ペットによる効果計算
 */
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

/**
 * 抵抗計算メイン
 */
function calculate() {
    // 1. 各種入力値の取得
    let wis = Math.max(0, parseInt(document.getElementById('input_wisdom').value) || 0);
    const wisBonus = getWisdomBonus(wis);
    document.getElementById('disp_wis_bonus').innerText = wisBonus;

    const rsBonus = document.getElementById('check_redstone').checked ? 5 : 0;
    const mbBonus = document.getElementById('check_mb').checked ? 14 : 0;
    const ptBonus = document.getElementById('check_potential').checked ? 10 : 0;
    const extraBonusTotal = rsBonus + mbBonus + ptBonus;

    // 石像全属性（抵抗）と 全属性ペナルティ減少の取得 (最大5にクランプ)
    const statueAll = Math.min(5, Math.max(0, parseInt(document.getElementById('statue_all').value) || 0));
    const statueAllPen = Math.min(5, Math.max(0, parseInt(document.getElementById('statue_all_pen').value) || 0));

    const otherBonus = Math.max(0, parseInt(document.getElementById('input_other_bonus').value) || 0);
    const petEffects = getPetBonuses();
    const fieldObj = FIELD_DEBUFFS[document.getElementById('input_field').value] || FIELD_DEBUFFS["none"];
    
    const fixed = Math.min(90, Math.max(0, parseInt(document.getElementById('input_fixed_debuff').value) || 0));
    const weak = Math.min(240, Math.max(0, parseInt(document.getElementById('input_weaken').value) || 0));
    const rAll = Math.max(0, parseInt(document.getElementById('rensei_all').value) || 0);

    const tbody = document.getElementById('result_tbody');
    tbody.innerHTML = '';

    // 2. 属性ごとに計算
    ATTRS.forEach(attr => {
        let equipTotal = 0;
        EQUIP_PARTS.forEach(p => {
            const val = document.getElementById(`val_${p.key}`).value;
            const sel = equipData.find(i => i.name === val);
            if (sel) equipTotal += sel[attr.key] || 0;
        });

        // 個別属性の石像ボーナスの取得 (最大5にクランプ)
        const statueSpec = Math.min(5, Math.max(0, parseInt(document.getElementById(`statue_${attr.key}`).value) || 0));

        // 1. 抵抗合計
        const rSpec = Math.max(0, parseInt(document.getElementById(`rensei_${attr.key}`).value) || 0);
        const baseTotal = equipTotal + wisBonus + otherBonus + petEffects.allRes + rAll + rSpec + extraBonusTotal + statueAll + statueSpec;

        // 2. フィールド低下の計算
        let attrFieldDebuff = fieldObj[attr.key];
        
        // 石像によるペナ減 = (個別Lv * 3%) + (ラークの鞘Lv * 5%)
        const statuePenReduction = (statueSpec * 3) + (statueAllPen * 5);
        const totalPenReduction = petEffects.penReduc[attr.key] + statuePenReduction;
        
        let fDebuff = Math.max(0, attrFieldDebuff - totalPenReduction);

        // --- 最終有効抵抗の算出 ---
        let finalBase = baseTotal - fDebuff - fixed - weak;
        let finalResist = finalBase > 70 ? 70 : finalBase;

        let finalHtml = `<span class="val-final">${finalResist}%</span>`;
        if (finalBase > 70) {
            finalHtml = `<span style="color:#888; font-size:0.85rem;">(${finalBase}%)</span><br>${finalHtml}`;
        }

        // 3. テーブルへ反映
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:${attr.color}">${attr.label}</td>
            <td>${baseTotal}%</td>
            <td>
                <span style="color:#ff7675">-${fDebuff}%</span> <span class="calc-sub">(ﾏｯﾌﾟ)</span><br>
                <span style="color:#ff7675">-${fixed}%</span> <span class="calc-sub">(固定)</span>
            </td>
            <td><span style="color:#e17055">-${weak}%</span></td>
            <td>${finalHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    saveSettings();
}

// 実行開始
init();