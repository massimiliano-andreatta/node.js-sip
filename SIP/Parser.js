const HeaderParser = {
    parse: (headers) => {
        // NOTE if you specify a key within the header object, the function will automatically return just the value of that key if it exists.
        //an example is the CSeq header, which has a count and a method. If you specify the key as CSeq, the function will return an object with the count and header name as keys.
        var checks = {
            "From": {contact:HeaderParser.Contact, tag: HeaderParser.Tag},
            'f': {contact:HeaderParser.Contact, tag: HeaderParser.Tag},
            "To": {contact:HeaderParser.Contact, transport: HeaderParser.Transport, tag: HeaderParser.Tag},
            't':{contact:HeaderParser.Contact, transport: HeaderParser.Transport, tag: HeaderParser.Tag},
            "Contact": {contact:HeaderParser.Contact, transport: HeaderParser.Transport, expires: HeaderParser.Expires},
            "Via": {uri: HeaderParser.URI, branch: HeaderParser.branchId},
            "v":{uri: HeaderParser.URI, branch: HeaderParser.branchId},
            "CSeq": {count: HeaderParser.Cseq, method: HeaderParser.Cseq},
            "WWW-Authenticate": {realm: HeaderParser.Realm, nonce: HeaderParser.Nonce, algorithm: HeaderParser.Algorithm, qop: HeaderParser.Qop},
            "Proxy-Authenticate": {realm: HeaderParser.Realm, nonce: HeaderParser.Nonce, algorithm: HeaderParser.Algorithm},
            "Authorization": {realm: HeaderParser.Realm, username: HeaderParser.Username, algorithm: HeaderParser.Algorithm, nonce: HeaderParser.Nonce, response: HeaderParser.Response},
            "Supported": HeaderParser.SpaceSeparated,
            "Allow-Events": HeaderParser.SpaceSeparated,
            "Call-ID": HeaderParser.CallID,
            "Max-Forwards": (str) => {return parseInt(str)},
            "Content-Length": (str) => {return parseInt(str)},
            "Subscription-State": (str) => {return str},
            "Event": (str) => {return str},
            "Expires": (str) => {return parseInt(str)},
            "Content-Type": (str) => {return str},
            "Content-Disposition": (str) => {return str},
            "Content-Encoding": (str) => {return str},
            "Content-Language": (str) => {return str},
            "User-Agent": (str) => {return str},
            "Server": (str) => {return str},
            "Accept": (str) => {return str},
            "Accept-Encoding": (str) => {return str},
        }
        var ret = {}
        for(var header in headers){
            var h = headers[header];
            if(typeof checks[header] !== "undefined"){
                if(typeof checks[header] == "function"){
                    ret[header] = checks[header](h);
                }else{
                    for(var check in checks[header]){
                        var c = checks[header][check](h);
                        if(c){
                            if(typeof ret[header] == "undefined"){
                                ret[header] = {}
                            }
                            if(typeof c == "object"){
                                if(typeof c[check] !== "undefined"){
                                    ret[header][check] = c[check];
                                }else{
                                    ret[header][check] = c;
                                }
                            }else{
                                ret[header][check] = c;
                            }
                        }
                    }
                }
            }
        }
        return ret;
    },
    
    Expires:(str) => {
        if(str.indexOf("expires=") > -1){
            return str.match(/expires=(.*)/)[1];
        }else{
            return false;
        }
    },

    branchId:(str) => {
        if(str.indexOf("branch=") > -1){
            var v = str.match(/branch=(.*)/)[1]
            return (v.indexOf(";") > -1) ? v.split(";")[0] : v;
        }else{
            return false
        }
    },

    FindKey:(str, key) => {
        var regex = new RegExp(key + "=(\"[^\"]*\"|[^,;]*)");
        var match = str.match(regex);
        if(match !== null){
            return match[1].replace(/"/g, '');
        }
        return false;
    },

    CallID:(str) => {
        return str;
    },

    Username:(str) => {
        //make work for <tel:1001> and <sip:1001@ip:port>
        var regex1 = /<sip:(.*)>/;
        var regex2 = /<tel:(.*)>/;

        var match1 = str.match(regex1);
        var match2 = str.match(regex2);

        if(match1 !== null){
          return match1[1].split("@")[0];
        }else if(match2 !== null){
          return match2[1];
        }else{
          return HeaderParser.FindKey(str, "username");
        }
    },

    Qop:(str) => {
        return HeaderParser.FindKey(str, "qop");
    },

    Algorithm:(str) => {
        return HeaderParser.FindKey(str, "algorithm");
    },

    Nonce:(str) => {
        return HeaderParser.FindKey(str, "nonce");
    },

    Tag:(str) => {
        return HeaderParser.FindKey(str, "tag");
    },

    Realm:(str) => {
        return HeaderParser.FindKey(str, "realm");
    },

    Response:(str) => {
        return HeaderParser.FindKey(str, "response");
    },

    Transport:(str) => {
        return HeaderParser.FindKey(str, "transport");
    },

    URI: (str) => {
        var regex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d+))?/;
        var match = str.match(regex);
        if (match !== null) {
            return {
                ip: match[1],
                port: match[2] ? match[2] : null,
            };
        } else {
            return false;
        }
    },

    Contact:(str) => {
        var match1 = str.match(/sip:(.*)/)
        var match2 = str.match(/tel:(.*)/)
        var username = HeaderParser.Username(str);
        var ret = {
          username:username,
        }

        if(match1 !== null){
          ret.ip = HeaderParser.URI(match1[0]).ip;
          ret.port = HeaderParser.URI(match1[0]).port;
        }else if(match2 !== null){
            ret.ip = match2[1];
        }

        return ret;
    },

    Quoted:(str) => {
        if(str.indexOf("\"") > -1){
            return str.split("\"")
        }else{
            return false;
        }
    },

    Cseq:(str) => {
        var v = HeaderParser.SpaceSeparated(str)
        if(v){
            return { count: v[0], method: v[1] }
        }else{
            return false;
        }
    },

    SpaceSeparated:(str) => {
        if(str.indexOf(" ") > -1){
            return str.split(" ")
        }else{
            return false;
        }
    },

    getQuotedValues:(str) => {
        const regex = /([^=\s]+)\s*=\s*(?:"([^"]*)"|([^,;]*))/g;
        let match;
        while ((match = regex.exec(str))) {
          const key = match[1];
          const value = match[2] || match[3];
        }
    },

}

const SIPHeaderParser = {
    headers: {},
    parse: (msg) => {
        var headers = msg.split('\r\n').map((h) => {return {[h.split(":")[0]]: h.slice(h.indexOf(":") + 1).trim()}}).filter((h) => {return Object.keys(h)[0] !== "" && Object.keys(h)[0].indexOf("SIP/2.0") == -1});
        //determine all header parameter names
        var headerNames = headers.map((h) => {
            console.log(h);
        });
        console.log(headerNames);
        return headers;
    },
}

const Parser = {
    parse: (message) => {
        const lines = message.split('\r\n');
        const firstLine = lines.shift();
        const isResponse = firstLine.startsWith('SIP');
      
        if (isResponse) {
          // Parse SIP response
            const [protocol, statusCode] = firstLine.split(' ');
            const statusText = firstLine.substr(protocol.length + statusCode.length + 2);
            const headers = {};
            let index = 0;
          
            // Parse headers
            while (index < lines.length && lines[index] !== '') {
                const line = lines[index];
                const colonIndex = line.indexOf(':');
                if (colonIndex !== -1) {
                    const headerName = line.substr(0, colonIndex).trim();
                    const headerValue = line.substr(colonIndex + 1).trim();
                    if (headers[headerName]) {
                        // If header name already exists, convert it to an array
                        if (Array.isArray(headers[headerName])) {
                          headers[headerName].push(headerValue);
                        } else {
                          headers[headerName] = [headers[headerName], headerValue];
                        }
                    } else {
                        headers[headerName] = headerValue;
                    }
                }
                index++;
            }
          
            // Parse message body if it exists
            const body = lines.slice(index + 1).join('\r\n');
          
            return {
                isResponse: true,
                protocol,
                statusCode: parseInt(statusCode),
                statusText,
                headers,
                body,
            };
        } else {
          // Parse SIP request
          const [method, requestUri, protocol] = firstLine.split(' ');
      
          const headers = {};
          let index = 0;
      
          // Parse headers
          while (index < lines.length && lines[index] !== '') {
            const line = lines[index];
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
              const headerName = line.substr(0, colonIndex).trim();
              const headerValue = line.substr(colonIndex + 1).trim();
              if (headers[headerName]) {
                // If header name already exists, convert it to an array
                if (Array.isArray(headers[headerName])) {
                  headers[headerName].push(headerValue);
                } else {
                  headers[headerName] = [headers[headerName], headerValue];
                }
              } else {
                headers[headerName] = headerValue;
              }
            }
            index++;
          }
      
          // Parse message body if it exists
          const body = lines.slice(index + 1).join('\r\n');
          return {
            isResponse: false,
            method,
            requestUri,
            protocol,
            headers,
            body,
          };
        }
    },

    ParseHeaders(headers){
        return HeaderParser.parse(headers);
    },

    extractHeaderParams: (header) => {
        const params = {};
        const regex = /([^=\s]+)=("[^"]*"|[^,\s]+)/g;
        let match;
      
        // Check if the header is wrapped in single quotes and remove them
        if (header.startsWith("'") && header.endsWith("'")) {
            header = header.slice(1, -1);
        }
      
        while ((match = regex.exec(header))) {
            const key = match[1];
            const value = match[2].replace(/"/g, '');
            params[key] = value;
        }
      
        // Handle additional format: 'SIP/2.0/UDP 192.168.1.2:6111;branch=z9hG4bK5358096010232X2'
        if (!Object.keys(params).length && header.includes(' ')) {
            const spaceIndex = header.indexOf(' ');
            const keyValue = header.slice(0, spaceIndex);
            const rest = header.slice(spaceIndex + 1);
          
            const semicolonIndex = rest.indexOf(';');
            const value = semicolonIndex !== -1 ? rest.slice(0, semicolonIndex) : rest;
          
            params[keyValue] = value;
        }
      
        return params;
    },
}

module.exports = {Parser, HeaderParser};