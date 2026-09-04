

/* =========================================================
   STARTUP ANIMATION
========================================================= */

window.addEventListener(
    "load",
    function(){

        setTimeout(
            function(){

                const loadingScreen =
                    document.getElementById(
                        "loadingScreen"
                    );

                loadingScreen.classList.add(
                    "hide"
                );

            },
            2500
        );

    }
);


function getStoredLanguage(){

    const savedLanguage =
        localStorage.getItem(
            "voiceguard-language"
        );

    if(
        savedLanguage &&
        ["en", "hi", "te"].includes(savedLanguage)
    ){
        return savedLanguage;
    }

    return "en";

}


function applyStoredLanguage(){

    const languageSelect =
        document.getElementById(
            "language"
        );

    if(!languageSelect){
        return;
    }

    languageSelect.value =
        getStoredLanguage();

}


function saveSelectedLanguage(language){

    if(!["en", "hi", "te"].includes(language)){
        return;
    }

    localStorage.setItem(
        "voiceguard-language",
        language
    );

}


function bindLanguageSelector(){

    const languageSelect =
        document.getElementById(
            "language"
        );

    if(!languageSelect){
        return;
    }

    applyStoredLanguage();

    languageSelect.addEventListener(
        "change",
        function(){

            const selectedLanguage =
                this.value;

            saveSelectedLanguage(
                selectedLanguage
            );

        }
    );

}


document.addEventListener(
    "DOMContentLoaded",
    function(){
        bindLanguageSelector();
        loadHistory();
        loadStoredSettings();
    }
);


/* =========================================================
   NAVIGATION
========================================================= */

function showPage(
    pageId,
    button
){

    document
        .querySelectorAll(".page")
        .forEach(
            page => {

                page.classList.remove(
                    "active"
                );

            }
        );


    document
        .getElementById(pageId)
        .classList.add("active");


    document
        .querySelectorAll(".nav-btn")
        .forEach(
            btn => {

                btn.classList.remove(
                    "active"
                );

            }
        );


    if(button){

        button.classList.add(
            "active"
        );

    }


    const sidebar = document.getElementById('mainSidebar');
    if (sidebar && sidebar.classList.contains('nav-open')) {
        sidebar.classList.remove('nav-open');
    }


    const titles = {

        dashboard:
            "Dashboard",

        detector:
            "Voice Detector",

        generator:
            "GAN Generator",

        history:
            "Detection History"

    };


    document
        .getElementById("pageTitle")
        .textContent =
        titles[pageId]
        ||
        "VoiceGuard AI";

}


/* =========================================================
   SETTINGS
========================================================= */

function toggleNavMenu(){
    const sidebar = document.getElementById('mainSidebar');
    if (sidebar) {
        sidebar.classList.toggle('nav-open');
    }
}


function openSettings(){

    document
        .getElementById(
            "settingsOverlay"
        )
        .classList.add("show");

}


function closeSettings(){

    document
        .getElementById(
            "settingsOverlay"
        )
        .classList.remove("show");

}


function closeOutside(event){

    if(
        event.target.id ===
        "settingsOverlay"
    ){

        closeSettings();

    }

}


function toggleSetting(element){

    element.classList.toggle(
        "active"
    );

    const toggles =
        Array.from(
            document.querySelectorAll(
                ".toggle"
            )
        );

    localStorage.setItem(
        "voiceguard-toggles",
        JSON.stringify(
            toggles.map(
                toggle =>
                    toggle.classList.contains("active")
            )
        )
    );

}


/* =========================================================
   INPUT SELECTION
========================================================= */

function selectInput(
    type,
    button
){

    document
        .querySelectorAll(
            ".input-tab"
        )
        .forEach(
            tab => {

                tab.classList.remove(
                    "active"
                );

            }
        );


    button.classList.add(
        "active"
    );


    if(type === "live"){

        document.getElementById(
            "liveInput"
        ).style.display =
        "block";


        document.getElementById(
            "uploadInput"
        ).style.display =
        "none";

    }

    else{

        document.getElementById(
            "liveInput"
        ).style.display =
        "none";


        document.getElementById(
            "uploadInput"
        ).style.display =
        "block";

    }

}


/* =========================================================
   TOAST
========================================================= */

function showToast(message){

    const toast =
        document.getElementById(
            "toast"
        );


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    setTimeout(
        function(){

            toast.classList.remove(
                "show"
            );

        },
        2500
    );

}


/* =========================================================
   MICROPHONE
========================================================= */

let mediaStream = null;

let audioContext = null;

let analyser = null;

let animationId = null;

let mediaRecorder = null;

let recordedChunks = [];

let currentRecordedAudio = null;

let generatorAudio = null;

let generatorAudioName = "generator-audio";

let generatorAudioUrl = null;

let generatorMediaRecorder = null;

let generatorRecordedChunks = [];

let generatedAudioUrl = null;

let historyAudioMap = new Map();

let historyRecords = [];

const historyStorageKey =
    "voiceguard-history";


function persistHistory(){

    try{

        localStorage.setItem(
            historyStorageKey,
            JSON.stringify(historyRecords)
        );

    }
    catch(error){

        console.warn(
            "History could not be saved:",
            error
        );

    }

}


function loadHistory(){

    try{

        const savedHistory =
            localStorage.getItem(
                historyStorageKey
            );

        const parsedHistory =
            savedHistory
                ? JSON.parse(savedHistory)
                : [];

        historyRecords =
            Array.isArray(parsedHistory)
                ? parsedHistory.filter(
                    record =>
                        record &&
                        record.rowId &&
                        typeof record.source === "string" &&
                        typeof record.score === "number"
                )
                : [];

    }
    catch(error){

        historyRecords = [];

        console.warn(
            "Saved history could not be loaded:",
            error
        );

    }

    historyRecords.forEach(
        record => renderHistoryRecord(record)
    );

    updateStoredStats();

}


function updateStoredStats(){

    const totalElement =
        document.getElementById(
            "totalScans"
        );

    const threatsElement =
        document.getElementById(
            "threatsDetected"
        );

    const realElement =
        document.getElementById(
            "realVoices"
        );

    if(
        totalElement &&
        threatsElement &&
        realElement
    ){

        totalElement.textContent =
            historyRecords.length;

        threatsElement.textContent =
            historyRecords.filter(
                record => record.isFake
            ).length;

        realElement.textContent =
            historyRecords.filter(
                record => !record.isFake
            ).length;

    }

}


function audioBlobToDataUrl(blob, rowId){

    if(!blob){
        return;
    }

    const reader =
        new FileReader();

    reader.onload =
        function(){

            const record =
                historyRecords.find(
                    item => item.rowId === rowId
                );

            if(!record){
                return;
            }

            record.audioData =
                reader.result;

            persistHistory();

        };

    reader.readAsDataURL(blob);

}


/* =========================================================
   START RECORDING
========================================================= */

async function startRecording(){

    try{

        mediaStream =
            await navigator
                .mediaDevices
                .getUserMedia({
                    audio:true
                });


        audioContext =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();


        analyser =
            audioContext
                .createAnalyser();


        const source =
            audioContext
                .createMediaStreamSource(
                    mediaStream
                );


        source.connect(
            analyser
        );


        analyser.fftSize =
            256;


        mediaRecorder =
            new MediaRecorder(
                mediaStream
            );


        recordedChunks = [];


        mediaRecorder.ondataavailable =
            function(event){

                if(
                    event.data &&
                    event.data.size > 0
                ){

                    recordedChunks.push(
                        event.data
                    );

                }

            };


        mediaRecorder.start();


        document
            .getElementById(
                "recordStatus"
            )
            .textContent =
            "Recording in progress...";


        document
            .getElementById(
                "recordBtn"
            )
            .textContent =
            "🔴 Recording";


        showToast(
            "Recording started"
        );


        drawVisualizer();

    }

    catch(error){

        console.error(error);

        showToast(
            "Microphone permission denied"
        );

    }

}


/* =========================================================
   VISUALIZER
========================================================= */

function drawVisualizer(){

    const canvas =
        document.getElementById(
            "visualizer"
        );


    const ctx =
        canvas.getContext(
            "2d"
        );


    canvas.width =
        canvas.clientWidth;


    canvas.height =
        canvas.clientHeight;


    const bufferLength =
        analyser.frequencyBinCount;


    const dataArray =
        new Uint8Array(
            bufferLength
        );


    function draw(){

        animationId =
            requestAnimationFrame(
                draw
            );


        analyser.getByteFrequencyData(
            dataArray
        );


        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        const barWidth =
            canvas.width /
            bufferLength *
            1.8;


        let x = 0;


        for(
            let i = 0;
            i < bufferLength;
            i++
        ){

            const barHeight =
                (
                    dataArray[i] /
                    255
                ) *
                canvas.height;


            ctx.fillStyle =
                "#0ea5e9";


            ctx.fillRect(
                x,
                canvas.height -
                    barHeight,
                barWidth,
                barHeight
            );


            x +=
                barWidth + 1;

        }

    }


    draw();

}


/* =========================================================
   STOP RECORDING
========================================================= */

function stopRecording(){

    if(
        mediaRecorder &&
        mediaRecorder.state !==
        "inactive"
    ){

        mediaRecorder.onstop =
            function(){

                currentRecordedAudio =
                    new Blob(
                        recordedChunks,
                        {
                            type:
                                mediaRecorder
                                    .mimeType ||
                                "audio/webm"
                        }
                    );


                runDetection(
                    "Live Recording",
                    currentRecordedAudio
                );


            };


        mediaRecorder.stop();

    }


    if(mediaStream){

        mediaStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

    }


    if(animationId){

        cancelAnimationFrame(
            animationId
        );

    }


    document
        .getElementById(
            "recordStatus"
        )
        .textContent =
        "Recording stopped";


    document
        .getElementById(
            "recordBtn"
        )
        .textContent =
        "Start Recording";


    showToast(
        "Analyzing recorded voice..."
    );

}


/* =========================================================
   AUDIO UPLOAD
========================================================= */

document
    .getElementById(
        "audioFile"
    )
    .addEventListener(
        "change",
        function(){

            if(
                this.files.length > 0
            ){

                runDetection(
                    this.files[0].name,
                    this.files[0]
                );


            }

        }
    );


/* =========================================================
   VOICE DETECTION
========================================================= */

function runDetection(
    source,
    sourceAudio = null
){

    const resultCard =
        document.getElementById(
            "resultCard"
        );


    resultCard.classList.add(
        "show"
    );


    const resultStatus =
        document.getElementById(
            "resultStatus"
        );


    const resultIcon =
        document.getElementById(
            "resultIcon"
        );


    resultStatus.textContent =
        "ANALYZING...";


    resultStatus.className =
        "result-status";


    resultIcon.textContent =
        "🔍";


    document
        .getElementById(
            "confidenceFill"
        )
        .style.width =
        "0%";


    document
        .getElementById(
            "confidenceText"
        )
        .textContent =
        "Analyzing";


    setTimeout(
        function(){

            /*
             * FRONTEND DEMO ONLY
             *
             * Later connect this section
             * to your Python GAN / ML model.
             */

            const score =
                Math.floor(
                    Math.random() * 50
                ) + 50;


            const isFake =
                score >= 65;


            const totalElement =
                document.getElementById(
                    "totalScans"
                );


            const threatsElement =
                document.getElementById(
                    "threatsDetected"
                );


            const realElement =
                document.getElementById(
                    "realVoices"
                );


            totalElement.textContent =
                Number(
                    totalElement.textContent
                ) + 1;


            if(isFake){

                threatsElement.textContent =
                    Number(
                        threatsElement
                            .textContent
                    ) + 1;


                resultStatus.textContent =
                    "AI-GENERATED / FAKE";


                resultStatus.classList.add(
                    "fake"
                );


                resultIcon.textContent =
                    "⚠️";

            }

            else{

                realElement.textContent =
                    Number(
                        realElement
                            .textContent
                    ) + 1;


                resultStatus.textContent =
                    "HUMAN / REAL";


                resultStatus.classList.add(
                    "real"
                );


                resultIcon.textContent =
                    "✓";

            }


            document
                .getElementById(
                    "confidenceFill"
                )
                .style.width =
                score + "%";


            document
                .getElementById(
                    "confidenceText"
                )
                .textContent =
                score + "%";


            document
                .getElementById(
                    "mfcc"
                )
                .textContent =
                (
                    Math.random() * 2
                ).toFixed(3);


            document
                .getElementById(
                    "jitter"
                )
                .textContent =
                (
                    Math.random() * 5
                ).toFixed(2)
                + "%";


            document
                .getElementById(
                    "spectral"
                )
                .textContent =
                (
                    Math.random() * 100
                ).toFixed(1);


            addHistory(
                source,
                isFake,
                score,
                sourceAudio
            );


            showToast(
                isFake
                    ?
                    "Warning: AI voice detected!"
                    :
                    "Voice appears to be real."
            );

        },
        1500
    );

}


/* =========================================================
   HISTORY
========================================================= */

function addHistory(
    source,
    isFake,
    score,
    sourceAudio = null
){

    const rowId =
        "history-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(16)
            .slice(2);

    const record = {
        rowId: rowId,
        time: new Date()
            .toLocaleTimeString(),
        source: source,
        isFake: isFake,
        score: score,
        audioData: null
    };

    historyRecords.push(record);
    persistHistory();

    const temporaryAudioUrl =
        sourceAudio
            ? URL.createObjectURL(sourceAudio)
            : null;

    if(sourceAudio){
        audioBlobToDataUrl(
            sourceAudio,
            rowId
        );
    }

    renderHistoryRecord(
        record,
        temporaryAudioUrl
    );

    updateStoredStats();

}


function renderHistoryRecord(
    record,
    temporaryAudioUrl = null
){

    const historyTable =
        document.getElementById(
            "historyTable"
        );


    const recentTable =
        document.getElementById(
            "recentTable"
        );


    const type =
        record.isFake
            ?
            "AI Generated"
            :
            "Human";


    const badge =
        record.isFake
            ?
            '<span class="badge fake">FAKE</span>'
            :
            '<span class="badge real">REAL</span>';


    if(
        historyTable.children.length === 1
        &&
        historyTable.children[0]
            .children.length === 1
    ){

        historyTable.innerHTML =
            "";

    }


    if(
        recentTable.children.length === 1
        &&
        recentTable.children[0]
            .children[0]
            .textContent
            .includes(
                "No detections"
            )
    ){

        recentTable.innerHTML =
            "";

    }


    const audioUrl =
        temporaryAudioUrl ||
        record.audioData ||
        null;


    if(audioUrl){

        historyAudioMap.set(
            record.rowId,
            audioUrl
        );

    }


    const row =
        document.createElement(
            "tr"
        );


    const audioCell =
        audioUrl
            ?
            buildHistoryAudioPlayer(
                record.rowId,
                audioUrl
            )
            :
            '<div class="history-audio-cell"><button class="history-listen-btn" disabled>Audio unavailable</button></div>';


    row.innerHTML = `

        <td>${record.time}</td>

        <td>${record.source}</td>

        <td>${type}</td>

        <td>${record.score}%</td>

        <td>${badge}</td>

        <td>${audioCell}</td>

    `;


    row.dataset.historyId =
        record.rowId;


    historyTable.prepend(
        row
    );


    const recentRow =
        document.createElement(
            "tr"
        );


    recentRow.innerHTML = `

        <td>${record.source}</td>

        <td>${type}</td>

        <td>${record.score}%</td>

        <td>${badge}</td>

    `;


    recentTable.prepend(
        recentRow
    );


    while(
        recentTable.children.length > 5
    ){

        recentTable.removeChild(
            recentTable.lastChild
        );

    }

}


function buildHistoryAudioPlayer(
    rowId,
    audioUrl
){

    return `

        <div class="history-audio-cell">

            <button
                class="history-listen-btn"
                data-history-id="${rowId}"
                type="button"
            >
                ▶ Listen / Replay Voice
            </button>

            <div class="history-audio-player">

                <audio
                    id="audio-${rowId}"
                    src="${audioUrl}"
                    preload="auto"
                ></audio>

                <button
                    class="history-play-btn"
                    data-history-id="${rowId}"
                    type="button"
                >
                    Play
                </button>

                <button
                    class="history-pause-btn"
                    data-history-id="${rowId}"
                    type="button"
                >
                    Pause
                </button>

                <button
                    class="history-stop-btn"
                    data-history-id="${rowId}"
                    type="button"
                >
                    Stop
                </button>

                <input
                    class="history-progress"
                    data-history-id="${rowId}"
                    type="range"
                    min="0"
                    max="100"
                    value="0"
                    step="0.1"
                    aria-label="Playback progress"
                >

                <span class="history-time" id="time-${rowId}">0:00 / 0:00</span>

            </div>

        </div>
    `;

}


document.addEventListener(
    "click",
    function(event){

        const target =
            event.target;


        if(
            !target.classList
        ){

            return;

        }


        const historyId =
            target.dataset.historyId;


        if(!historyId){

            return;

        }


        const audioEl =
            document.getElementById(
                "audio-" + historyId
            );


        if(!audioEl){

            return;

        }


        if(
            target.classList.contains(
                "history-listen-btn"
            )
        ){

            audioEl.currentTime = 0;
            audioEl.play();
            return;

        }


        if(
            target.classList.contains(
                "history-play-btn"
            )
        ){

            audioEl.play();
            return;

        }


        if(
            target.classList.contains(
                "history-pause-btn"
            )
        ){

            audioEl.pause();
            return;

        }


        if(
            target.classList.contains(
                "history-stop-btn"
            )
        ){

            audioEl.pause();
            audioEl.currentTime = 0;

        }

    }
);


document.addEventListener(
    "timeupdate",
    function(event){

        const target =
            event.target;


        if(
            !target.matches("audio")
        ){

            return;

        }


        const historyId =
            target.id.replace(
                "audio-",
                ""
            );


        const range =
            document.querySelector(
                '.history-progress[data-history-id="' + historyId + '"]'
            );


        const timeLabel =
            document.getElementById(
                "time-" + historyId
            );


        if(
            range &&
            target.duration
        ){

            const percent =
                (target.currentTime /
                    target.duration) *
                100;

            range.value =
                percent;

        }


        if(timeLabel){

            timeLabel.textContent =
                formatTime(target.currentTime) +
                " / " +
                formatTime(target.duration || 0);

        }

    },
    true
);


document.addEventListener(
    "ended",
    function(event){

        const target =
            event.target;


        if(
            !target.matches("audio")
        ){

            return;

        }


        const historyId =
            target.id.replace(
                "audio-",
                ""
            );


        const range =
            document.querySelector(
                '.history-progress[data-history-id="' + historyId + '"]'
            );


        if(range){

            range.value = 100;

        }

    },
    true
);


function formatTime(seconds){

    if(!seconds ||
        Number.isNaN(seconds)){

        return "0:00";

    }


    const mins =
        Math.floor(seconds / 60);

    const secs =
        Math.floor(seconds % 60);

    return mins +
        ":" +
        (secs < 10 ? "0" : "") +
        secs;

}


/* =========================================================
   CLEAR HISTORY
========================================================= */

function clearHistory(){

    historyAudioMap.forEach(
        function(url){

            URL.revokeObjectURL(
                url
            );

        }
    );

    historyAudioMap.clear();

    historyRecords = [];

    localStorage.removeItem(
        historyStorageKey
    );


    document
        .getElementById(
            "historyTable"
        )
        .innerHTML = `

        <tr>

            <td colspan="6">
                No detection history
            </td>

        </tr>

    `;


    document
        .getElementById(
            "recentTable"
        )
        .innerHTML = `

        <tr>

            <td>
                No detections yet
            </td>

            <td>-</td>

            <td>-</td>

            <td>-</td>

        </tr>

    `;


    document
        .getElementById(
            "totalScans"
        )
        .textContent =
        "0";


    document
        .getElementById(
            "threatsDetected"
        )
        .textContent =
        "0";


    document
        .getElementById(
            "realVoices"
        )
        .textContent =
        "0";


    showToast(
        "Detection history cleared"
    );

}


/* =========================================================
   GAN GENERATOR
========================================================= */

function setGeneratorAudio(audio, name){

    generatorAudio = audio;
    generatorAudioName = name || "generator-audio";

    if(generatorAudioUrl){
        URL.revokeObjectURL(generatorAudioUrl);
    }

    generatorAudioUrl = URL.createObjectURL(audio);

    const preview = document.getElementById("generatorAudioPreview");

    preview.src = generatorAudioUrl;
    preview.style.display = "block";
    document.getElementById("generatorAudioControls").style.display = "flex";

}


function playGeneratorAudio(){

    document.getElementById("generatorAudioPreview").play();

}


function stopGeneratorAudio(){

    const preview = document.getElementById("generatorAudioPreview");

    preview.pause();
    preview.currentTime = 0;

}


document
    .getElementById("generatorAudioFile")
    .addEventListener("change", function(){

        if(this.files.length){
            setGeneratorAudio(this.files[0], this.files[0].name);
        }

    });


async function startGeneratorRecording(){

    try{

        const stream = await navigator.mediaDevices.getUserMedia({audio:true});

        generatorRecordedChunks = [];
        generatorMediaRecorder = new MediaRecorder(stream);

        generatorMediaRecorder.ondataavailable = function(event){

            if(event.data && event.data.size){
                generatorRecordedChunks.push(event.data);
            }

        };

        generatorMediaRecorder.onstop = function(){

            const recordedAudio = new Blob(
                generatorRecordedChunks,
                {type: generatorMediaRecorder.mimeType || "audio/webm"}
            );

            setGeneratorAudio(recordedAudio, "recorded-generator-audio.webm");
            stream.getTracks().forEach(track => track.stop());

        };

        generatorMediaRecorder.start();
        document.getElementById("generatorRecordBtn").disabled = true;
        document.getElementById("generatorStopBtn").disabled = false;

    }
    catch(error){

        console.error("Generator recording failed:", error);
        showToast("Microphone permission denied");

    }

}


function stopGeneratorRecording(){

    if(generatorMediaRecorder && generatorMediaRecorder.state !== "inactive"){
        generatorMediaRecorder.stop();
    }

    document.getElementById("generatorRecordBtn").disabled = false;
    document.getElementById("generatorStopBtn").disabled = true;

}

async function generateVoice(){

    const script =
        document
            .getElementById(
                "voiceScript"
            )
            .value
            .trim();


    if(!generatorAudio){

        showToast(
            "Upload or record audio first"
        );

        return;

    }


    const result =
        document.getElementById(
            "generatorResult"
        );


    result.classList.add(
        "show"
    );


    result.innerHTML = `

        <strong>
            Generating Synthetic Voice...
        </strong>

        <p
            style="
            color:#94a3b8;
            font-size:12px;
            margin-top:8px;
            "
        >

            GAN model is processing
            the input.

        </p>

    `;


    try{

        const formData = new FormData();

        formData.append(
            "audio",
            generatorAudio,
            generatorAudioName
        );

        formData.append(
            "script",
            script
        );

        formData.append(
            "voice_model",
            document.getElementById("voiceModel").value
        );

        const apiUrl =
            window.VOICE_API_URL ||
            "http://localhost:5000/api/generate";

        const response = await fetch(
            apiUrl,
            {
                method: "POST",
                body: formData
            }
        );

        if(!response.ok){
            const detail = await response.text();
            throw new Error(
                detail || "Voice generation failed"
            );
        }

        const generatedAudio = await response.blob();

        if(!generatedAudio.size){
            throw new Error("The API returned empty audio");
        }

        if(generatedAudioUrl){
            URL.revokeObjectURL(generatedAudioUrl);
        }

        generatedAudioUrl = URL.createObjectURL(
            generatedAudio
        );

            result.innerHTML = `

                <strong>
                    ✓ Synthetic Voice Generated
                </strong>

                <audio
                    id="generatedAudio"
                    controls
                    style="width:100%;margin-top:15px"
                    src="${generatedAudioUrl}"
                ></audio>

                <button
                    class="secondary-btn"
                    style="margin-top:15px"
                    onclick="playGeneratedVoice()"
                >

                    ▶ Play Generated Voice

                </button>

                <a
                    class="secondary-btn"
                    style="display:inline-block;margin:15px 0 0 8px;text-decoration:none"
                    href="${generatedAudioUrl}"
                    download="voiceguard-generated-audio.wav"
                >

                    ↓ Download

                </a>

                <p
                    style="
                    color:#94a3b8;
                    font-size:12px;
                    margin-top:8px;
                    "
                >

                    The synthetic audio is ready
                    for testing.

                </p>

                <button
                    class="secondary-btn"
                    style="margin-top:15px"
                    onclick="testGeneratedVoice()"
                >

                    Test with Detector

                </button>

            `;


            showToast(
                "Synthetic voice generated"
            );

    }
    catch(error){

        console.error("Voice generation failed:", error);

        result.innerHTML = `

            <strong>
                Voice generation failed
            </strong>

            <p style="color:#fca5a5;font-size:12px;margin-top:8px">
                The audio could not be processed. Check the backend connection and try again.
            </p>

        `;

        showToast(
            "Voice generation failed"
        );

    }

}


/* =========================================================
   TEST GENERATED VOICE
========================================================= */

function testGeneratedVoice(){

    const detectorButton =
        document.querySelectorAll(
            ".nav-btn"
        )[1];


    showPage(
        "detector",
        detectorButton
    );


    setTimeout(
        function(){

            runDetection(
                "GAN Generated Voice"
            );

        },
        300
    );

}


function playGeneratedVoice(){

    const audio = document.getElementById("generatedAudio");

    if(audio){
        audio.play();
    }

}


/* =========================================================
   CLEAR AUDIO
========================================================= */

function clearAudio(){

    const fileInput =
        document.getElementById(
            "audioFile"
        );


    if(fileInput){

        fileInput.value =
            "";

    }


    document
        .getElementById(
            "recordStatus"
        )
        .textContent =
        "Ready to record";


    document
        .getElementById(
            "resultCard"
        )
        .classList.remove(
            "show"
        );


    showToast(
        "Temporary audio cleared"
    );

}


/* =========================================================
   RESET SETTINGS
========================================================= */

function resetSettings(){

    localStorage.removeItem(
        "volume"
    );

    localStorage.removeItem(
        "sensitivity"
    );

    localStorage.removeItem(
        "voiceguard-language"
    );

    localStorage.removeItem(
        "voiceguard-voice"
    );

    localStorage.removeItem(
        "voiceguard-toggles"
    );

    applyStoredLanguage();

    loadStoredSettings();


    showToast(
        "Settings reset"
    );

}


function loadStoredSettings(){

    const volume =
        localStorage.getItem(
            "volume"
        );

    const sensitivity =
        localStorage.getItem(
            "sensitivity"
        );

    const volumeInput =
        document.getElementById(
            "volume"
        );

    const sensitivityInput =
        document.getElementById(
            "sensitivity"
        );

    const voiceSelect =
        document.getElementById(
            "voice"
        );

    const savedVoice =
        localStorage.getItem(
            "voiceguard-voice"
        );

    const savedToggles =
        localStorage.getItem(
            "voiceguard-toggles"
        );

    if(volume !== null && volumeInput){
        volumeInput.value = volume;
    }

    if(sensitivity !== null && sensitivityInput){
        sensitivityInput.value = sensitivity;
    }

    if(savedVoice !== null && voiceSelect){
        voiceSelect.value = savedVoice;
    }

    if(savedToggles){
        try{

            const toggleValues =
                JSON.parse(savedToggles);

            document
                .querySelectorAll(
                    ".toggle"
                )
                .forEach(
                    (toggle, index) => {

                        if(typeof toggleValues[index] === "boolean"){
                            toggle.classList.toggle(
                                "active",
                                toggleValues[index]
                            );
                        }

                    }
                );

        }
        catch(error){
            localStorage.removeItem(
                "voiceguard-toggles"
            );
        }
    }

}


/* =========================================================
   RANGE SETTINGS
========================================================= */

document
    .getElementById(
        "volume"
    )
    .addEventListener(
        "input",
        function(){

            localStorage.setItem(
                "volume",
                this.value
            );

        }
    );


document
    .getElementById(
        "voice"
    )
    .addEventListener(
        "change",
        function(){

            localStorage.setItem(
                "voiceguard-voice",
                this.value
            );

        }
    );


document
    .getElementById(
        "sensitivity"
    )
    .addEventListener(
        "input",
        function(){

            localStorage.setItem(
                "sensitivity",
                this.value
            );

        }
    );

