const utils = require('../utils.js');
const Session = require('./Session.js');

class SessionManager {
    constructor() {
        this.sessions = {};
    }

    new_session(props) {
        props.listen_sdp = props.listen_sdp;
        this.sessions[props.call_id] = new Session(props);
        return this.sessions[props.call_id];
    }
}

module.exports = SessionManager;