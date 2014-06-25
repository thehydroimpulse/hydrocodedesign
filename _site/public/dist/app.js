define("app",
  ["stack"],
  function(__dependency1__) {
    "use strict";
    var Stack = __dependency1__["default"];

    var Component = React.createClass({
      render: function() {
        return React.DOM.h1({}, new Stack());
      }
    });

    React.renderComponent(new Component(), document.getElementById('app'));
  });
define("stack",
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = React.createClass({
      render: function() {
        return React.DOM.svg({});
      }
    });
  });