export default React.createClass({
  getInitialState: function() {
    return { started: false };
  },

  start: function() {
    this.setState({started: true });
  },

  render: function() {
    if (this.state.started) {
      return React.DOM.svg({ width: "550px", height: "200px" });
    } else {
      return React.DOM.div({ className: 'menu' }, [
        React.DOM.h1({}, "Getting Started!"),
        React.DOM.button({ onClick: this.start }, "Begin")
      ]);
    }
  }
})
