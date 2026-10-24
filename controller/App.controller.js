sap.ui.define([
	"sap/ui/core/mvc/Controller"
], function (Controller) {
	"use strict";

	return Controller.extend("modeldev.controller.App", {

		onInit: function () {
			this.getOwnerComponent().getRouter().attachRouteMatched(this._onRouteMatched, this);
		},

		_onRouteMatched: function (oEvent) {
			var sLayout = oEvent.getParameter("name") === "detail" ? "TwoColumnsMidExpanded" : "OneColumn";
			this.getOwnerComponent().getModel("app").setProperty("/layout", sLayout);
		}
	});
});
