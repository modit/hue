var express = require('express')
  , app = express()
;

app.use(express.static(__dirname + '/example'));

app.listen(process.env.WEB_PORT || 80, function(){
  console.log('Server Listening on port ' + (process.env.WEB_PORT || 80));
});