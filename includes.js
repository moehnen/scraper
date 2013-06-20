

casper.on('error', function (msg, backtrace) {
    this.echo("=========================");
    this.echo("ERROR:");
    this.echo(msg);
    this.echo(backtrace);
    this.echo("=========================");
});

//casper.on('resource.requested', function (resource, request) {

//    casper.log("requested: " + resource['url'], "info");

//    //if ((/http:\/\/ad./gi).test(resource['url'])) {
//    //    console.log('The url of the request is matching. Aborting: ' + resource['url']);
//    //    request.abort();
//    //}
//});
