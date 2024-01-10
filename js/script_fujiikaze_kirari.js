const hzs = { // [ド,レ,ミ,ファ,ソ,ラ,シ]=[C,D,E,F,G,A,B]
    'c3': 130, // C3
    'c3#': 138,
    'd3': 146, 
    'd3#': 155,
    'e3': 164, 
    'e3#': 0, // 存在しない音（鍵盤の配置の都合上いれておく）
    'f3': 174, 
    'f3#': 184,
    'g3': 195, 
    'g3#': 207,
    'a3': 220, 
    'a3#': 233,
    'b3': 246, 
    'b3#': 0, 
    'c4': 261, // C4
    'c4#': 277,
    'd4': 294, 
    'd4#': 311,
    'e4': 330, 
    'e4#': 0, 
    'f4': 349, 
    'f4#': 369,
    'g4': 392, 
    'g4#': 415,
    'a4': 440, 
    'a4#': 466,
    'b4': 493,
    'b4#': 0, 
    'c5': 523, // C5
    'c5#': 554,
    'd5': 587,
    'd5#': 622,
    'e5': 659,
    'e5#': 0,
    'f5': 698,
    'f5#': 740,
    'g5': 784,
    'g5#': 831,
    'a5': 880,
    'a5#': 932,
    'b5': 988,
    'b5#': 0,
    'c6': 1046, // C6
    'c6#': 1109,
    'd6': 1175,
    'd6#': 1245,
    'e6': 1319,
};

// Web Audio API関連のグローバル変数
let audioCtx = null;
let oscillator = null;
let gainNode = null;

let vol = 5; // ボリューム（0～100）
let stoping = false; // このフラグがtrueになったら演奏中止

// ボタン要素
const $startPlaying = document.getElementById('start-playing');
const $stopPlaying = document.getElementById('stop-playing');

window.onload = () => {
    initKeyboards();
    initVolume();

    $startPlaying.addEventListener('click', () => startPlaying());
    $stopPlaying.addEventListener('click', () => stopPlaying());
    // startPlaying関数とstopPlaying関数は後述
}

function initKeyboards(){
    // 連想配列のキーのうち、arr1には白鍵、arr2には黒鍵に対応したものを格納する
    const arr1 = [];
    const arr2 = [];
    for(let key in hzs){
        if(key.indexOf('#') == -1)
            arr1.push(key);
        else
            arr2.push(key);
    }

    const $field = document.getElementById('field');
    let maxBottom = 0;
    const keyboards = [];

    for(let i = 0; i < arr1.length; i++){
        let top = 40 * i; // 配列のインデックスから白鍵のtopの座標を求める
        const $button = document.createElement('button');
        $button.style.left = '0px';
        $button.style.top = top + 'px';
        $button.className = 'white';
        $button.id = arr1[i];
        $button.innerHTML = `<div class = "floor-name">${getName(arr1[i])}</div>`; // 階名を表示する（後述）
        $field.appendChild($button);
        keyboards.push($button);

        maxBottom = top + 40; // 鍵盤のbottomの座標を格納する（最後に格納されたものが最大値になる）
    }

    // fieldの高さを確定する（一番下の白鍵のbottom）
    $field.style.height = maxBottom + 'px';

    for(let i = 0; i < arr2.length; i++){
        // 存在しない黒鍵はスキップ（bX# eX#なら存在しない）
        if(arr2[i].indexOf('#') != -1 && (arr2[i].indexOf('b') != -1 || arr2[i].indexOf('e') != -1))
            continue;

        const $button = document.createElement('button');
        let top = 40 * i + 20; // 配列のインデックスから黒鍵のtopの座標を求める
        $button.style.left = '0px';
        $button.style.top = top + 'px';
        $button.id = arr2[i];
        $button.className = 'black';
        $field.appendChild($button);
        keyboards.push($button);
    }

    // 自動演奏をするだけなら必要ないがとりあえず押下したら音が出るようにする
    keyboards.forEach(keyboard => {
        const hz = hzs[keyboard.id];
        if(hz == undefined)
            return;
        keyboard.addEventListener('mousedown', () => onKeyDown(keyboard));
        keyboard.addEventListener('mouseup', () => onKeyUp(keyboard));
        keyboard.addEventListener('touchstart', () => onKeyDown(keyboard));
        keyboard.addEventListener('touchend', () => onKeyUp(keyboard));
    });

    document.addEventListener('mouseup', () => stop());
}

function getName(id){
    if(id.indexOf('c') != -1) return 'ド';
    if(id.indexOf('d') != -1) return 'レ';
    if(id.indexOf('e') != -1) return 'ミ';
    if(id.indexOf('f') != -1) return 'ファ';
    if(id.indexOf('g') != -1) return 'ソ';
    if(id.indexOf('a') != -1) return 'ラ';
    if(id.indexOf('b') != -1) return 'シ';
}

function initVolume(){
    const $vol = document.getElementById('vol');
    const $volLabel = document.getElementById('vol-label');
    if($vol == null || $volLabel == null)
        return;
    $vol.addEventListener('input',() => {
        $volLabel.innerHTML = $vol.value;
        vol = $vol.value;
        if(gainNode!=null){
            gainNode.gain.value=vol/100;
        }
    });
    $vol.value = 5;
}

function onKeyDown(keyboard){
    const hz = hzs[keyboard.id];
    if(hz == undefined)
        return;
    keyboard.style.backgroundColor = ' rgb(65, 237, 240)'; // 押下された鍵盤の色を変える
    playFromHz(hz); // 後述（実は前回のものと同じ）
}

function onKeyUp(keyboard){
    // 押下されていた鍵盤の色を元に戻す（白鍵なら白。黒鍵なら黒）
    keyboard.style.backgroundColor = keyboard.id.indexOf('#') == -1 ? '#fff' :'#000';
    stop(); // 後述（実は前回のものと同じ）
}

function playFromHz(hz){
    if(audioCtx == null)
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    if(gainNode == null){
        gainNode = audioCtx.createGain();
        gainNode.gain.value=vol/100;
    }
    if(oscillator == null){
        oscillator = audioCtx.createOscillator();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(hz, audioCtx.currentTime);
        oscillator.connect(gainNode).connect(audioCtx.destination);
        oscillator.start();
    }
}

function stop(){
    if(oscillator!==null){
        oscillator.stop();
        oscillator=null;
    }
}
// 自動演奏をする (藤井風 kirari)
async function playTime(name, beat){
    let elm = null;
    if(name != ""){
        elm = document.getElementById(name);
        if(elm != null)
            elm.style.backgroundColor = 'rgb(58, 163, 228)'; // 鳴っている音に対応する鍵盤の色を変える
        const hz = hzs[name];
        if(hz != undefined)
            playFromHz(hz);
    }
    await sleep(400 * beat);
    stop();
    if(elm != null)
        elm.style.backgroundColor = elm.id.indexOf('#') == -1 ? '#fff' :'#000'; // 色を元に戻す
    await sleep(35);
}

async function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}
const data = [
    // part1
    'b3', 0.5,'d4', 0.5,'e4', 0.5,'f4#', 1,'f4#', 0.5,'e4', 0.25,'a4', 0.75,'g4', 0.25,'f4#', 0.75,
    'e4', 0.5,'f4#', 1,'f4#', 0.5,'e4', 0.25,'a4', 0.75,'g4', 0.5,'f4#', 0.5,'e4', 0.5,'f4#', 0.75,
    'd4', 0.25,'d4', 2,'d4', 0.5,'e4', 0.25,'c4#', 3,

    // part1
    'b3', 0.5,'d4', 0.5,'e4', 0.5,'f4#', 1,'f4#', 0.5,'e4', 0.25,'a4', 0.75,'g4', 0.25,'f4#', 0.75,
    'e4', 0.5,'f4#', 1,'f4#', 0.5,'e4', 0.25,'a4', 0.75,'g4', 0.5,'f4#', 0.5,'e4', 0.5,'f4#', 0.75,
    'd4', 0.25,'d4', 2,'d4', 0.5,'e4', 0.25,'c4#', 3,

    // part2
    'd4', 0.5,'f4#', 0.5,'a4', 0.5,'a4#', 1.0,'a4#', 0.5,'a4', 0.25,'a4#', 0.75,'a4', 0.25,'g4', 0.75,
    'd4', 0.5,'a4#', 1,'a4#', 0.5,'a4', 0.25,'a4#', 0.75,'a4', 0.5,'a4#', 0.5,'c5', 0.5,'a4#', 0.75,
    'a4', 0.25,'a4', 3,'g4', 1,'f4', 1,'e4', 0.5,'f4', 0.5,'a4', 1,'d4', 1,

    // part3
    'a4#', 0.5,'a4', 0.25,'a4#', 0.75,'a4', 0.5,'g4', 0.5,'d4', 0.5,'a4#', 1,'a4#', 0.5,'a4', 0.25,
    'a4#', 0.75,'a4', 0.5,'a4#', 0.5,'c5', 0.5,'a4#', 0.75,'a4', 0.25,'a4', 3,'g4', 2,'f4#', 0.25,
    'g4', 0.25,'a4', 2,

    // part4
    'f4#', 1,'f4#', 0.5,'e4', 0.25,'a4', 0.75,'g4', 0.25,'f4#', 0.75,'e4', 0.5,'f4#', 1,'f4#', 0.5,
    'e4', 0.25,'a4', 0.75,'g4', 0.5,'f4#', 0.5,'e4', 0.5,'f4#', 0.75,'d4', 0.25,'d4', 2,'d4', 0.5,
    'e4', 0.25,'c4#', 3,

    // part1 (+a)
    'b3', 0.5,'d4', 0.5,'e4', 0.5,'f4#', 1,'f4#', 0.5,'e4', 0.25,'a4', 0.75,'g4', 0.25,'f4#', 0.75,
    'e4', 0.5,'f4#', 1,'f4#', 0.5,'e4', 0.25,'a4', 0.75,'g4', 0.5,'f4#', 0.5,'e4', 0.5,'f4#', 0.75,
    'd4', 0.25,'d4', 2,'d4', 0.5,'e4', 0.25,'c4#', 0.5,'b3', 0.25,'a3', 0.25,'b3', 0.25,'c4#', 2,

    // part2
    'd4', 0.5,'f4#', 0.5,'a4', 0.5,'a4#', 1.0,'a4#', 0.5,'a4', 0.25,'a4#', 0.75,'a4', 0.25,'g4', 0.75,
    'd4', 0.5,'a4#', 1,'a4#', 0.5,'a4', 0.25,'a4#', 0.75,'a4', 0.5,'a4#', 0.5,'c5', 0.5,'a4#', 0.75,
    'a4', 0.25,'a4', 3,'g4', 1,'f4', 1,'e4', 0.5,'f4', 0.5,'a4', 1,'d4', 1,

    // part3
    'a4#', 0.5,'a4', 0.25,'a4#', 0.75,'a4', 0.5,'g4', 0.5,'d4', 0.5,'a4#', 1,'a4#', 0.5,'a4', 0.25,
    'a4#', 0.75,'a4', 0.5,'a4#', 0.5,'c5', 0.5,'a4#', 0.75,'a4', 0.25,'a4', 3,'g4', 2,'f4#', 0.25,
    'g4', 0.25,'a4', 2,

    // sabi-1
    'a4', 0.25,'b4', 0.25,'d5', 0.5,'e5', 1,'f5#', 0.75,'d5', 1.25,'a4', 0.25,'b4', 0.25,'d5', 0.5,
    'e5', 1,'a5', 0.75,'f5#', 1.25,'f5#', 0.5,'a5', 0.5,'b5', 1,'f5#', 0.75,'e5', 1.5,'f5#', 0.5,
    'g5', 0.5,'a5', 1,'e5', 0.75,'d5', 1.25,'b4', 0.5,'d5', 0.5,'e5', 1,'f5#', 0.75,'d5', 1.25,

    // sabi-2
    'b4', 0.5,'d5', 0.5,'e5', 1,'a5', 0.75,'f5#', 1.25,'f5#', 0.5,'a5', 0.5,'b5', 1,'f5#', 0.75,
    'e5', 1.25,'f5#', 0.5,'g5', 0.5,'a5', 1,'e5', 0.75,'d5', 1,'b4', 0.5,'d5', 0.5,'e5', 0.5,
    'f5#', 1,'f5#', 0.5,'e5', 0.25,'a5', 0.75,'g5', 0.25,'f5#', 0.75,'e5', 0.5,'f5#', 1.25,'e5', 0.25,
    'a5', 0.75,'g5', 0.25,'f5#', 0.75,'e5', 0.5,'f5#', 1,'f5#', 0.5,'e5', 0.25,'a5', 0.75,'g5', 0.5,
    'f5#', 0.5,'e5', 0.5,'f5#', 0.5,'d5', 0.25,'d5', 1.25,'e5', 0.5,'c5', 0.25,'c5', 1.5,

    // sabi-3
    'f5#', 1,'f5#', 0.5,'e5', 0.25,'a5', 0.75,'g5', 0.25,'f5#', 0.875,'e5', 0.5,'f5#', 1,'f5#', 0.5,
    'e5', 0.25,'a5', 0.75,'g5', 0.25,'f5#', 0.75,'e5', 0.5,'f5#', 1,'f5#', 0.5,'e5', 0.25,'a5', 0.75,
    'g5', 0.5,'f5#', 0.5,'e5', 0.5,'f5#', 0.375,'f5', 0.375,'f5#', 1.5,

    // sabi-4
    'e5', 0.25,'d5#', 0.75,'c5#', 0.25,'b4', 0.75,'g4#', 0.25,'f4#', 0.75,'e4', 0.25,'d4#', 0.75,
    'c4#', 0.25,'b3', 1.75,
    
    // sabi-5
    'f4#', 0.75,'f4#', 0.75,'f4#', 0.25,'b3', 0.25,'d4', 0.25,'f4#', 0.75,'e4', 0.25,'d4', 0.75,'e4', 0.75,
    'e4', 0.75,'e4', 0.25,'a3', 0.25,'c4#', 0.25,'e4', 0.75,'d4', 0.25,'c4#', 0.75,'d4', 0.75,'d4', 0.75,
    'd4', 0.25,'g3', 0.25,'b3', 0.25,'d4', 0.75,'c4#', 0.25,'b3', 0.75,

    // sabi-6
    'c4#', 0.75,'d4', 0.75,'e4', 0.75,'f4#', 0.75,'a4', 1,'b4', 0.75,'b4', 0.75,'b4', 0.25,'b3', 0.25,
    'd4', 0.25,'b4', 0.75,'a4', 0.25,'g4', 0.75,'c5#', 0.75,'c5#', 0.75,'c5#', 0.25,'c4#', 0.25,'e4', 0.25,
    'c5#', 0.75,'b4', 0.25,'a4', 1,'d5', 0.75,'d5', 0.75,'d5', 0.25,'d4', 0.25,'g4', 0.25,'d5', 0.75,
    'c5#', 0.25,'d5', 0.75,'e5', 0.75,'e5', 0.75,'e5', 0.75,'f5#', 0.75,'a5', 1.5,
];
async function startPlaying(){
    // スタートボタンを非表示にして、ストップボタンを表示する
    stoping = false;
    $startPlaying.style.display = 'none';
    $stopPlaying.style.display = 'block';

    for(let i = 0; i < data.length; i += 2){
        if(stoping)
            break;
        await playTime(data[i], data[i+1]);
    }

    // ストップボタンを非表示にしてスタートボタンを表示する
    $startPlaying.style.display = 'block';
    $stopPlaying.style.display = 'none';
}
function stopPlaying(){
    stoping = true;
}