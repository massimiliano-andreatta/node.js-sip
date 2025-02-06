const { spawn } = require('child_process');
const Parser = require('../SDP').Parser;

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

class Session {
    constructor(props) {
        this.call_id = props.call_id;

        this.invite_sdp = props.invite_sdp;
        this.listen_sdp = props.listen_sdp;

        this.callback = props.callback;
        this.speechCallback = props.speechCallback;
        this.silenceCallback = props.silenceCallback;

        this.ffmpeg = null;

        ffmpeg.setFfmpegPath(ffmpegPath);
    }

    detected_codec() {
        let parsed_sdp = Parser.parse(this.invite_sdp);
        let selected_codec = parsed_sdp.codecs[0];

        parsed_sdp.codecs.forEach(codec => {
            if (codec.name == 'opus') {
                selected_codec = codec;
            }
        });

        // Se opus non è disponibile, prova con G711 (PCMU o PCMA)
        if (selected_codec.name != 'opus') {
            parsed_sdp.codecs.forEach(codec => {
                if (codec.name == 'PCMU' || codec.name == 'PCMA') {
                    selected_codec = codec;
                }
            });
        }

        // Se nessun codec valido è stato trovato, seleziona il primo disponibile
        if (!['opus', 'PCMU', 'PCMA'].includes(selected_codec.name)) {
            console.log('Nessun codec opus o G711 trovato, selezionato codec di fallback:', selected_codec);
        }

        return selected_codec;
    }

    send(path_file) {

        this.stopListen();

        const selected_codec = this.detected_codec();
        let parsed_sdp = Parser.parse(this.invite_sdp);

        // Avvia il processo di invio dell'audio
        this.ffmpeg = spawn('ffmpeg', [
            '-re',  // Invio a velocità di riproduzione reale
            '-loglevel', 'error',  // Mostra log di debug per diagnosticare problemi
            '-i', path_file,  // File audio di input
            '-acodec', selected_codec.codec,  // Codec audio
            '-ar', selected_codec.rate,  // Frequenza di campionamento
            '-ac', selected_codec.channels,  // Numero di canali
            '-payload_type', selected_codec.id,  // Payload type RTP
            '-ssrc', '123456',  // Identificatore SSRC
            '-f', 'rtp',  // Formato di output RTP
            '-rtbufsize', '10M',  // Buffer più grande (10MB)
            '-flush_packets', '1',  // Forza il flush dei pacchetti
            '-max_muxing_queue_size', '1024',  // Aumenta la coda di multiplexing
            '-muxdelay', '0.5',  // Ritardo per il muxing
            '-sdp_file', 'stream_send.sdp',  // (Opzionale) genera un file SDP per debug
            `rtp://${parsed_sdp.ip}:${parsed_sdp.port}`  // Destinazione RTP
        ]);

        this.ffmpeg.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        this.ffmpeg.stderr.on('data', (data) => {
            const errorOutput = data.toString();
            console.error('FFmpeg Error:', errorOutput);

            if (errorOutput.includes('error')) {
                // Qui puoi aggiungere logica per trattare l'errore, se necessario
                console.log("Errore durante l'invio del file.");
            }
        });

        this.ffmpeg.on('exit', (code) => {
            if (code === 0) {
                console.log('Audio inviato correttamente.');
                this.callback({ type: 'AUDIO_SENT' });
                this.startListen();
            } else {
                console.error(`Errore nell'invio audio. Codice di uscita: ${code}`);
                this.stopListen();
            }
        });
    }

    stopListen() {
        if (this.ffmpeg) {
            this.ffmpeg.kill('SIGINT');
        }
    }

    startListen() {

        this.stopListen();

        const selected_codec = this.detected_codec();
        console.log('Codec audio selezionato:', selected_codec);

        let parsed_sdp = Parser.parse(this.listen_sdp);

        const rtpUrl = `rtp://${parsed_sdp.ip}:${parsed_sdp.port}`;

        ffmpeg(rtpUrl)
            .input('pipe:0')
            .inputOptions([
                '-f sdp',                 // Passa il formato SDP
                '-f rtp',                 // Specifica RTP come formato
                '-vn',                    // Disabilita il video
            ])
            .audioCodec(selected_codec.codec)       // Codec G.711 A-law
            .audioFilters('silencedetect=n=-50dB:d=1') // Rileva silenzio con soglia di -50dB per 1 secondo
            .audioFrequency(selected_codec.rate)         // Frequenza di campionamento (8000 Hz per G.711)
            .audioChannels(selected_codec.channels)            // Mono (G.711 è mono)
            .on('start', (commandLine) => {
                console.log('Comando FFmpeg:', commandLine);
            })
            .on('stderr', (stderrLine) => {
                // Filtra le righe di log per rilevare i segnali di silenzio
                const silenceDetected = stderrLine.match(/silence_start: (\d+\.\d+)/);
                if (silenceDetected) {
                    console.log('Inizio silenzio a:', silenceDetected[1]);
                }

                const silenceEndDetected = stderrLine.match(/silence_end: (\d+\.\d+)/);
                if (silenceEndDetected) {
                    console.log('Fine silenzio a:', silenceEndDetected[1]);
                }
            })
            .on('end', () => {
                console.log('Elaborazione completata!');
            })
            .on('error', (err) => {
                console.error('Errore:', err.message);
            })
            .pipe(process.stdout, { end: false });

        /*
 
        

    this.ffmpeg = spawn('ffmpeg', [
        '-hide_banner',                                    // Nasconde il banner di avvio di ffmpeg
        '-loglevel', 'debug',                               // Dettagli tecnici nei log
        '-tune', 'zerolatency',                             // Ottimizza per bassa latenza
        '-rtbufsize', '5M',                                 // Imposta il buffer RTP
        '-analyzeduration', '0',                            // Nessuna analisi avanzata del flusso
        '-probesize', '32',                                 // Dimensione di probing minima
        '-vn',                                              // Disabilita video
        '-acodec', selected_codec.codec,                    // Codec audio selezionato
        '-ar', selected_codec.rate,                         // Frequenza di campionamento
        '-ac', selected_codec.channels,                     // Numero di canali
        '-f', 'rtp',                                        // Formato flusso RTP
        '-i', listen_sdp,                                   // Indirizzo flusso RTP
        '-protocol_whitelist', 'rtp',                       // Permetti protocolli RTP/UDP
        // '-sdp_file', 'stream_listen.sdp',                // Opzionale: genera un file SDP per debug
        // '-af', 'silencedetect=noise=-30dB:d=1',          // Opzionale: rilevamento silenzio
    ]);

    this.ffmpeg.stdin.on('data', (data) => {
        const output = data.toString();
        console.log(`ffmpeg: ${output}`);

        if (output.includes('RTP connection established')) {
            console.log('Connessione RTP stabilita, ascolto iniziato');
            this.callback({ type: 'LISTENING_STARTED' });
        }

        if (output.includes('silence_start')) {
            silenceCallback(); // 🔇 Silenzio rilevato
        } else if (output.includes('silence_end')) {
            speechCallback(output); // 🎙️ Voce rilevata
        }
    });

    this.ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        console.log(`ffmpeg: ${output}`);

        if (output.includes('Failed to connect') || output.includes('No data received')) {
            console.error('Errore nella connessione al flusso RTP');
            this.callback({ type: 'LISTENING_FAILED' });
        }

        // Gestisci il caso in cui il flusso è stato ricevuto
        if (output.includes('RTP packet received')) {
            console.log('Flusso audio ricevuto, ascolto iniziato');
            this.callback({ type: 'LISTENING_STARTED' });
        }
    });

    this.ffmpeg.on('close', (code) => {
        console.log(`ffplay terminato con codice: ${code}`);
    });
        
        
        */

    }
}

module.exports = Session;
