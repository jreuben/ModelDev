sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device",
	"modeldev/model/StructureStore"
], function (UIComponent, JSONModel, Device, StructureStore) {
	"use strict";

	return UIComponent.extend("modeldev.Component", {
		metadata: {
			manifest: "json",
			interfaces: ["sap.ui.core.IAsyncContentCreation"]
		},

		init: function () {
			UIComponent.prototype.init.apply(this, arguments);

			var oDeviceModel = new JSONModel(Device);
			oDeviceModel.setDefaultBindingMode("OneWay");
			this.setModel(oDeviceModel, "device");

			// Layout of the FlexibleColumnLayout, driven by the current route
			this.setModel(new JSONModel({ layout: "OneColumn" }), "app");

			// Default model: { structures: [ { name, description, fields: [ { key, type, defaultValue, defaultValues, isArray } ] } ] }
			var oModel = new JSONModel({ structures: StructureStore.load() });
			// Two-way edits in the UI (key, type, default, array flag) are saved immediately
			oModel.attachPropertyChange(this.persist, this);
			this.setModel(oModel);

			this.getRouter().initialize();
		},

		/** Writes the current structures to browser storage. */
		persist: function () {
			StructureStore.save(this.getModel().getProperty("/structures"));
		}
	});
});
