

const parse = obj => {
    const headers = obj.Headers;
    const contents = obj.Contents;

    var headersString = "";
    var contentsStrings = [];
    for(var i = 0; i < headers.length; i++){
        headersString += `<th>${headers[i]}</th>`;
    }

    for(var i = 0; i < contents[0].length; i++){
        var contentsString = "";
        for(var j = 0; j < contents.length; j++){
            var cont = contents[j][i];
            if(cont === true)  cont = "✓";
            if(cont === false) cont = "☓";
            contentsString += `<td>${cont}</td>`;
        }
        contentsStrings.push(contentsString);
    }

    var fullContentsString = "";
    const fullHeadersString = `<tr>${headersString}</tr>`;
    for(var i = 0; i < contentsStrings.length; i++){
        fullContentsString += `<tr>${contentsStrings[i]}</tr>`;
    }

    const fullTableString = 
    `<table>
        <thead>
        ${fullHeadersString}
        </thead>
        <tbody>
        ${fullContentsString}
        </tbody>
    </table>`;

    const retHtml = 
    `<html>
    <head>
    <link rel="stylesheet" href="tablecss.css">
    </head>
    <body>
        <header>
            <img src="logo.png">
        </header>
        ${fullTableString}
    </body>
    </html>`;
    return retHtml;
}

module.exports.parse = parse;