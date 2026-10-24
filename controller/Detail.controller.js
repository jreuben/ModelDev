sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/Fragment",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"modeldev/model/StructureStore",
	"modeldev/model/formatter",
	"modeldev/controller/NameDialog"
], function (Controller, Fragment, JSONModel, MessageBox, MessageToast, StructureStore, formatter, NameDialog) {
	"use strict";

	return Controller.extend("modeldev.controller.Detail", {

		formatter: formatter,

		onInit: function () {
			this._oViewModel = new JSONModel({
				typeOptions: [],
				usedByText: "",
				hasSelection: false
			});
			this.getView().setModel(this._oViewModel, "view");
			this.getOwnerComponent().getRouter().getRoute("detail").attachPatternMatched(this._onDetailMatched, this);
		},

		_onDetailMatched: function (oEvent) {
			var sName = oEvent.getParameter("arguments").name;
			var iIndex = this._getStructures().map(function (oStructure) {
				return oStructure.name;
			}).indexOf(sName);
			if (iIndex === -1) {
				MessageToast.show(this._getText("notFound", [sName]));
				this.getOwnerComponent().getRouter().navTo("master", {}, true);
				return;
			}
			this.byId("fieldsTable").removeSelections(true);
			this._oViewModel.setProperty("/hasSelection", false);
			this.getView().bindElement("/structures/" + iIndex);
			this._refreshViewState();
		},

		/** Rebuilds the type list (EDM types + other structures) and the "used by" text. */
		_refreshViewState: function () {
			var sName = this._getStructure().name;
			var aStructures = this._getStructures();

			var aOptions = StructureStore.EDM_TYPES.map(function (sType) {
				return { key: sType, group: this._getText("groupEdm"), icon: "" };
			}, this);
			// A structure cannot contain itself; other structures are offered sorted by name
			aStructures.map(function (oStructure) {
				return oStructure.name;
			}).filter(function (sOther) {
				return sOther !== sName;
			}).sort(function (a, b) {
				return a.localeCompare(b);
			}).forEach(function (sOther) {
				aOptions.push({ key: sOther, group: this._getText("groupStructure"), icon: "sap-icon://tree" });
			}, this);
			this._oViewModel.setProperty("/typeOptions", aOptions);

			var aUsages = StructureStore.getUsages(aStructures, sName);
			this._oViewModel.setProperty("/usedByText", aUsages.length ? aUsages.join(", ") : this._getText("usedByNone"));
		},

		/* =========================================================== */
		/* Table                                                       */
		/* =========================================================== */

		onTableUpdateFinished: function (oEvent) {
			this.byId("fieldsTitle").setText(this._getText("keysCount", [oEvent.getParameter("total")]));
			this._validateKeys();
			if (this._bFocusNewRow) {
				this._bFocusNewRow = false;
				var aItems = this.byId("fieldsTable").getItems();
				if (aItems.length) {
					aItems[aItems.length - 1].getCells()[0].focus();
				}
			}
		},

		onTableSelectionChange: function () {
			this._oViewModel.setProperty("/hasSelection", this.byId("fieldsTable").getSelectedItems().length > 0);
		},

		onAddRow: function () {
			var sPath = this._getFieldsPath();
			var oModel = this.getView().getModel();
			oModel.setProperty(sPath, oModel.getProperty(sPath).concat([{
				key: "",
				type: "Edm.String",
				defaultValue: "",
				defaultValues: [],
				isArray: false
			}]));
			this._bFocusNewRow = true;
			this._persist();
		},

		onDeleteRow: function (oEvent) {
			this._deleteFields([this._getFieldIndex(oEvent.getSource().getBindingContext())]);
		},

		onDeleteSelectedRows: function () {
			this._deleteFields(this.byId("fieldsTable").getSelectedContexts().map(this._getFieldIndex));
		},

		_deleteFields: function (aIndices) {
			// Row indices shift after deletion, so any remaining selection would point at other rows
			this.byId("fieldsTable").removeSelections(true);
			this._oViewModel.setProperty("/hasSelection", false);
			var sPath = this._getFieldsPath();
			var oModel = this.getView().getModel();
			var aFields = oModel.getProperty(sPath).filter(function (oField, i) {
				return aIndices.indexOf(i) === -1;
			});
			oModel.setProperty(sPath, aFields);
			this._persist();
			MessageToast.show(this._getText("rowsDeleted", [aIndices.length]));
		},

		onKeyChange: function () {
			this._validateKeys();
		},

		onTypeChange: function (oEvent) {
			var oContext = oEvent.getSource().getBindingContext();
			// Default values only apply to primitive types
			if (!formatter.canHaveDefault(oContext.getProperty("type"))) {
				oContext.getModel().setProperty("defaultValue", "", oContext);
				oContext.getModel().setProperty("defaultValues", [], oContext);
				this._persist();
			}
		},

		/** Carries the default over when switching between a single value (Input) and a list (MultiInput). */
		onArrayToggle: function (oEvent) {
			var oContext = oEvent.getSource().getBindingContext();
			var oModel = oContext.getModel();
			var bArray = oContext.getProperty("isArray");
			// Switching back to a single value keeps the first list entry
			var oDefaults = StructureStore.splitDefault(oContext.getProperty(bArray ? "defaultValue" : "defaultValues"), bArray);
			oModel.setProperty("defaultValue", oDefaults.defaultValue, oContext);
			oModel.setProperty("defaultValues", oDefaults.defaultValues, oContext);
			this._persist();
		},

		/** Adds the value typed into the MultiInput (Enter or focus out) as a default value token. */
		onDefaultTokenAdd: function (oEvent) {
			var oMultiInput = oEvent.getSource();
			var sValue = oMultiInput.getValue().trim();
			if (!sValue) {
				return;
			}
			var oContext = oMultiInput.getBindingContext();
			var aValues = oContext.getProperty("defaultValues");
			var sError = StructureStore.validateDefault(oContext.getProperty("type"), sValue)
				|| (aValues.indexOf(sValue) !== -1 ? this._getText("defaultDuplicate", [sValue]) : null);
			if (sError) {
				// Keep the text so it can be corrected
				oMultiInput.setValueState("Error");
				oMultiInput.setValueStateText(sError);
				return;
			}
			oMultiInput.setValue("");
			oContext.getModel().setProperty("defaultValues", aValues.concat([sValue]), oContext);
			this._persist();
		},

		/** While typing, drop the error of a rejected entry and show the state of the existing tokens again. */
		onDefaultTokenLiveChange: function (oEvent) {
			var oMultiInput = oEvent.getSource();
			var oContext = oMultiInput.getBindingContext();
			var sType = oContext.getProperty("type");
			var aValues = oContext.getProperty("defaultValues");
			oMultiInput.setValueState(formatter.defaultValueState(sType, aValues));
			oMultiInput.setValueStateText(formatter.defaultValueStateText(sType, aValues));
		},

		onDefaultTokenUpdate: function (oEvent) {
			if (oEvent.getParameter("type") !== "removed") {
				return;
			}
			var oContext = oEvent.getSource().getBindingContext();
			var aRemoved = oEvent.getParameter("removedTokens").map(function (oToken) {
				return oToken.getKey();
			});
			oContext.getModel().setProperty("defaultValues", oContext.getProperty("defaultValues").filter(function (sValue) {
				return aRemoved.indexOf(sValue) === -1;
			}), oContext);
			this._persist();
		},

		/** Marks empty and duplicate keys in the table. */
		_validateKeys: function () {
			var aInputs = this.byId("fieldsTable").getItems().map(function (oItem) {
				return oItem.getCells()[0];
			});
			var mCounts = {};
			aInputs.forEach(function (oInput) {
				var sKey = oInput.getValue().trim();
				mCounts[sKey] = (mCounts[sKey] || 0) + 1;
			});
			aInputs.forEach(function (oInput) {
				var sKey = oInput.getValue().trim();
				var sError = !sKey ? this._getText("keyRequired")
					: mCounts[sKey] > 1 ? this._getText("keyDuplicate", [sKey]) : "";
				oInput.setValueState(sError ? "Error" : "None");
				oInput.setValueStateText(sError);
			}, this);
		},

		/* =========================================================== */
		/* Structure popover                                           */
		/* =========================================================== */

		onShowTypeStructure: function (oEvent) {
			var oButton = oEvent.getSource();
			var sType = oButton.getBindingContext().getProperty("type");
			this._getPopover().then(function (oPopover) {
				oPopover.getModel("popover").setData({
					name: sType,
					title: this._getText("structureOf", [sType]),
					nodes: StructureStore.buildTree(this._getStructures(), sType)
				});
				this.byId("structureTree").expandToLevel(1);
				oPopover.openBy(oButton);
			}.bind(this));
		},

		onOpenPopoverStructure: function () {
			this._getPopover().then(function (oPopover) {
				var sName = oPopover.getModel("popover").getProperty("/name");
				oPopover.close();
				this.getOwnerComponent().getRouter().navTo("detail", { name: sName });
			}.bind(this));
		},

		_getPopover: function () {
			if (!this._pPopover) {
				this._pPopover = Fragment.load({
					id: this.getView().getId(),
					name: "modeldev.fragment.StructurePopover",
					controller: this
				}).then(function (oPopover) {
					oPopover.setModel(new JSONModel(), "popover");
					this.getView().addDependent(oPopover);
					return oPopover;
				}.bind(this));
			}
			return this._pPopover;
		},

		/* =========================================================== */
		/* Header actions                                              */
		/* =========================================================== */

		onEdit: function () {
			var oStructure = this._getStructure();
			var sOldName = oStructure.name;
			NameDialog.open({
				title: this._getText("editTitle"),
				confirmText: this._getText("save"),
				structures: this._getStructures(),
				name: sOldName,
				description: oStructure.description,
				owner: this.getView()
			}).then(function (oResult) {
				if (!oResult) {
					return;
				}
				var oModel = this.getView().getModel();
				var sPath = this.getView().getBindingContext().getPath();
				oModel.setProperty(sPath + "/description", oResult.description);
				if (oResult.name !== sOldName) {
					oModel.setProperty(sPath + "/name", oResult.name);
					// Keep keys typed with this structure pointing at it under the new name
					this._getStructures().forEach(function (oOther, i) {
						oOther.fields.forEach(function (oField, j) {
							if (oField.type === sOldName) {
								oModel.setProperty("/structures/" + i + "/fields/" + j + "/type", oResult.name);
							}
						});
					});
					this.getOwnerComponent().getRouter().navTo("detail", { name: oResult.name }, true);
				}
				this._persist();
				MessageToast.show(this._getText("saved"));
			}.bind(this));
		},

		onDeleteStructure: function () {
			var sName = this._getStructure().name;
			var aUsages = StructureStore.getUsages(this._getStructures(), sName);
			if (aUsages.length) {
				MessageBox.error(this._getText("deleteBlocked", [sName, aUsages.join(", ")]));
				return;
			}
			MessageBox.confirm(this._getText("deleteConfirm", [sName]), {
				actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
				emphasizedAction: MessageBox.Action.DELETE,
				onClose: function (sAction) {
					if (sAction !== MessageBox.Action.DELETE) {
						return;
					}
					var oModel = this.getView().getModel();
					oModel.setProperty("/structures", this._getStructures().filter(function (oStructure) {
						return oStructure.name !== sName;
					}));
					this.getView().unbindElement();
					this._persist();
					MessageToast.show(this._getText("deleted", [sName]));
					this.getOwnerComponent().getRouter().navTo("master", {}, true);
				}.bind(this)
			});
		},

		onClose: function () {
			this.getOwnerComponent().getRouter().navTo("master");
		},

		/* =========================================================== */
		/* JSON preview                                                */
		/* =========================================================== */

		onShowJson: function () {
			var oStructure = StructureStore.toPlain([this._getStructure()])[0];
			var oData = {
				title: this._getText("jsonTitle", [oStructure.name]),
				mode: "definition",
				definition: JSON.stringify(oStructure, null, 2),
				sample: JSON.stringify(StructureStore.buildSample(this._getStructures(), oStructure.name), null, 2)
			};
			if (!this._pJsonDialog) {
				this._pJsonDialog = Fragment.load({
					id: this.getView().getId(),
					name: "modeldev.fragment.JsonDialog",
					controller: this
				}).then(function (oDialog) {
					oDialog.setModel(new JSONModel(), "json");
					this.getView().addDependent(oDialog);
					return oDialog;
				}.bind(this));
			}
			this._pJsonDialog.then(function (oDialog) {
				oDialog.getModel("json").setData(oData);
				oDialog.open();
			});
		},

		onCopyJson: function () {
			this._pJsonDialog.then(function (oDialog) {
				var oJsonModel = oDialog.getModel("json");
				var sText = oJsonModel.getProperty("/" + oJsonModel.getProperty("/mode"));
				var fnDone = MessageToast.show.bind(MessageToast, this._getText("copied"));
				var fnFailed = MessageToast.show.bind(MessageToast, this._getText("copyFailed"));
				if (navigator.clipboard && window.isSecureContext) {
					navigator.clipboard.writeText(sText).then(fnDone, fnFailed);
				} else {
					fnFailed();
				}
			}.bind(this));
		},

		onCloseJson: function () {
			this._pJsonDialog.then(function (oDialog) {
				oDialog.close();
			});
		},

		/* =========================================================== */
		/* Helpers                                                     */
		/* =========================================================== */

		_getStructures: function () {
			return this.getView().getModel().getProperty("/structures");
		},

		_getStructure: function () {
			return this.getView().getBindingContext().getObject();
		},

		_getFieldsPath: function () {
			return this.getView().getBindingContext().getPath() + "/fields";
		},

		/** Index of a field from its context path ".../fields/<index>". */
		_getFieldIndex: function (oContext) {
			return parseInt(oContext.getPath().split("/").pop(), 10);
		},

		_persist: function () {
			this.getOwnerComponent().persist();
		},

		_getText: function (sKey, aArgs) {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
		}
	});
});
