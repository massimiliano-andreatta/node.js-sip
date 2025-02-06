const Parser = {

    custom: (offerSDP, localIP, localPort) => {

        const parsingOfferSDP = Parser.parse(offerSDP);

        const sdpLines = offerSDP.split("\r\n");

        // Cambia il valore "o=" (origin) con un nuovo session ID e version
        const sessionID = Math.floor(Math.random() * 1000000);
        const origin = `o=root ${sessionID} ${sessionID} IN IP4 ${localIP}`;

        // Cambia il valore "c=" (connection) con il tuo IP locale
        const connection = `c=IN IP4 ${localIP}`;

        // Cambia il valore "m=" (media) con la porta locale per l'audio
        const media = `m=audio ${parsingOfferSDP.port} RTP/AVP 8 18 0 111 101`;

        // Costruisce l'SDP di risposta
        const responseSDP = [
            "v=0",
            origin,
            "s=Asterisk PBX Response",
            connection,
            "t=0 0",
            media,
            "a=rtpmap:8 PCMA/8000",
            "a=rtpmap:18 G729/8000",
            "a=fmtp:18 annexb=no",
            "a=rtpmap:0 PCMU/8000",
            "a=rtpmap:111 G726-32/8000",
            "a=rtpmap:101 telephone-event/8000",
            "a=fmtp:101 0-16",
            "a=ptime:20",
            "a=maxptime:150",
            "a=sendrecv"
        ].join("\r\n");

        return `${responseSDP}\r\n`;
    },

    parse: (sdp) => {
        let port = sdp.match(/m=audio (\d+) RTP/)[1];
        let ip = sdp.match(/c=IN IP4 (\d+\.\d+\.\d+\.\d+)/)[1];
        let codec_ids = sdp.match(/m=audio \d+ RTP\/AVP (.+)/)[1].split(' ');
        let ffmpeg_codec_map = {
            'opus': 'libopus',
            'PCMU': 'pcm_mulaw',
            'PCMA': 'pcm_alaw',
            'telephone-event': 'pcm_mulaw',
            'speex': 'speex',
            'G722': 'g722',
            'G722': 'g722',
            'G729': 'g729',
            'GSM': 'gsm',
            'AMR': 'amr',
            'AMR-WB': 'amr_wb',
            'iLBC': 'ilbc',
            'iSAC': 'isac',
        }

        let codecs = [];
        sdp.split('\n').forEach(line => {
            if (line.includes('a=rtpmap')) {
                let codec = line.match(/a=rtpmap:(\d+) (.+)/)[2];
                let c_id = line.match(/a=rtpmap:(\d+) (.+)/)[1];
                codecs.push({
                    name: codec.split('/')[0],
                    rate: codec.split('/')[1],
                    channels: codec.split('/')[2] !== undefined ? codec.split('/')[2] : 1,
                    id: c_id,
                    codec: ffmpeg_codec_map[codec.split('/')[0]]
                })
            }
        })

        return {
            ip: ip,
            port: port,
            codecs: codecs,
        }
    }
}

module.exports = Parser;