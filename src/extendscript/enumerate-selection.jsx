var myDoc = app.activeDocument;
var mySel = myDoc.selection;
var myTextFrame;

function pad(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length-size);
}

//https://community.adobe.com/t5/illustrator-discussions/a-script-to-find-and-replace-layer-names/td-p/4960031
const offset = prompt('offs',1);
const leadingZeroes = prompt('leads',2);
for (i=0;i<mySel.length;i++) {
    //https://stackoverflow.com/questions/2998784/how-to-output-numbers-with-leading-zeros-in-javascript
    //padStart works on current browser JS engine but not
    //on adobe ExtendScript, sadly.
	//*mySel[i].name = String(i+parseInt(offset)).padStart(leadingZeroes,'0');//*/
    mySel[i].name = String(pad(i+parseInt(offset),leadingZeroes));
}