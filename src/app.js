import Stack from "stack";

var Component = React.createClass({
  render: function() {
    return React.DOM.h1({}, new Stack());
  }
});

React.renderComponent(new Component(), document.getElementById('app'));
