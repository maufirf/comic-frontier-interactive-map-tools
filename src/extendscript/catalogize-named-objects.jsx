//https://stackoverflow.com/questions/56738640/javascript-adobe-illustrator-json-not-defined-decoding-json-encoded-clipboard
#include 'json2.min.js';

var layers = app.activeDocument.layers;
var catalogue = {};
var i = 0;

function catalogizeNamedChildren(parentCatalogue, parent, lastIndex){
    var pathItems = parent.pathItems;
    if (pathItems.length>0) {
        for (i=0;i<pathItems.length;i++) {
            parentCatalogue.pathItems.push(pathItems[i].name);
        }
    }
    var groupItems = parent.groupItems;
    if (groupItems.length>0) {
        for (i=0;i<groupItems.length;i++) {
            parentCatalogue.groupItems[groupItems[i].name] = {groupItems:{}, pathItems:[], };
            catalogizeNamedChildren(parentCatalogue.groupItems[groupItems[i].name], groupItems[i],i);
        }
    }
    i=lastIndex;
}

alert(layers.length);
for (i=0;i<layers.length;i++) {
    layer = layers[i];
    catalogue[layer.name] = {groupItems:{}, pathItems:[],};
    catalogizeNamedChildren(catalogue[layer.name],layer,i);
    alert(layer.name);
    alert(i);
}

// https://gist.github.com/ltfschoen/79ab3e98723e61660117
alert(catalogue);

//alert(JSON.stringify(data));
//https://stackoverflow.com/questions/40215422/illustrator-script-generate-a-json-file
var file = File.saveDialog('Export');
file.open('w');
file.write(JSON.stringify(catalogue, null, '\t'));
file.close();

alert('bruh')