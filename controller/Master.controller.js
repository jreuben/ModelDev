sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"modeldev/model/StructureStore",
	"modeldev/model/formatter",
	"modeldev/controller/NameDialog"
], function (Controller, Filter, FilterOperator, MessageBox, MessageToast, StructureStore, formatter, NameDialog) {
	"use strict";

	return Controller.extend("modeldev.controller.Master", {

		formatter: formatter,

		onInit: function () {
			this._sSelectedName = null;
			var oRouter = this.getOwnerComponent().getRouter();
			oRouter.getRoute("master").attachPatternMatched(this._onMasterMatched, this);
			oRouter.getRoute("detail").attachPatternMatched(this._onDetailMatched, this);
		},

		_onMasterMatched: function () {
			this._sSelectedName = null;
			this.byId("structureList").removeSelections(true);
		},

		_onDetailMatched: function (oEvent) {
			this._sSelectedName = oEvent.getParameter("arguments").name;
			this._syncSelection();
		},

		/** Selects the list item of the structure shown in the detail column. */
		_syncSelection: function () {
			var oList = this.byId("structureList");
			var sName = this._sSelectedName;
			var oItem = oList.getItems().filter(function (oListItem) {
				return oListItem.getBindingContext().getProperty("name") === sName;
			})[0];
			if (oItem) {
				oList.setSelectedItem(oItem);
			} else {
				oList.removeSelections(true);
			}
		},

		onListUpdateFinished: function (oEvent) {
			this.byId("listTitle").setText(this._getText("structuresCount", [oEvent.getParameter("total")]));
			this._syncSelection();
		},

		onSelectionChange: function (oEvent) {
			var oItem = oEvent.getParameter("listItem");
			this._navToStructure(oItem.getBindingContext().getProperty("name"));
		},

		onSearch: function (oEvent) {
			var sQuery = oEvent.getParameter("newValue").trim();
			var aFilters = sQuery ? [new Filter({
				filters: [
					new Filter({ path: "name", operator: FilterOperator.Contains, value1: sQuery, caseSensitive: false }),
					new Filter({ path: "description", operator: FilterOperator.Contains, value1: sQuery, caseSensitive: false })
				],
				and: false
			})] : [];
			this.byId("structureList").getBinding("items").filter(aFilters);
		},

		onCreate: function () {
			var oModel = this.getView().getModel();
			NameDialog.open({
				title: this._getText("createTitle"),
				confirmText: this._getText("create"),
				structures: oModel.getProperty("/structures"),
				owner: this.getView()
			}).then(function (oResult) {
				if (!oResult) {
					return;
				}
				var aStructures = oModel.getProperty("/structures").concat([{
					name: oResult.name,
					description: oResult.description,
					fields: [{ key: "", type: "Edm.String", defaultValue: "", defaultValues: [], isArray: false }]
				}]);
				oModel.setProperty("/structures", aStructures);
				this.getOwnerComponent().persist();
				MessageToast.show(this._getText("created", [oResult.name]));
				this._navToStructure(oResult.name);
			}.bind(this));
		},

		onExport: function () {
			var aStructures = StructureStore.toPlain(this.getView().getModel().getProperty("/structures"));
			var oBlob = new Blob([JSON.stringify({ structures: aStructures }, null, 2)], { type: "application/json" });
			var sUrl = URL.createObjectURL(oBlob);
			var oLink = document.createElement("a");
			oLink.href = sUrl;
			oLink.download = "json-structures.json";
			document.body.appendChild(oLink);
			oLink.click();
			document.body.removeChild(oLink);
			setTimeout(function () {
				URL.revokeObjectURL(sUrl);
			}, 0);
		},

		onImport: function () {
			var oInput = document.createElement("input");
			oInput.type = "file";
			oInput.accept = ".json,application/json";
			oInput.addEventListener("change", function () {
				var oFile = oInput.files && oInput.files[0];
				if (oFile) {
					oFile.text().then(this._importText.bind(this));
				}
			}.bind(this));
			oInput.click();
		},

		_importText: function (sText) {
			var aStructures;
			try {
				aStructures = StructureStore.normalize(JSON.parse(sText));
			} catch (e) {
				MessageBox.error(this._getText("importFailed", [e.message]));
				return;
			}
			MessageBox.confirm(this._getText("importConfirm", [aStructures.length]), {
				emphasizedAction: MessageBox.Action.OK,
				onClose: function (sAction) {
					if (sAction !== MessageBox.Action.OK) {
						return;
					}
					this.getView().getModel().setProperty("/structures", aStructures);
					this.getOwnerComponent().persist();
					this.getOwnerComponent().getRouter().navTo("master", {}, true);
					MessageToast.show(this._getText("imported", [aStructures.length]));
				}.bind(this)
			});
		},

		_navToStructure: function (sName) {
			this.getOwnerComponent().getRouter().navTo("detail", { name: sName });
		},

		_getText: function (sKey, aArgs) {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
		}
	});
});
