sap.ui.define([
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Input",
	"sap/m/Label",
	"sap/m/TextArea",
	"sap/ui/layout/form/SimpleForm",
	"modeldev/model/StructureStore"
], function (Dialog, Button, Input, Label, TextArea, SimpleForm, StructureStore) {
	"use strict";

	/**
	 * Dialog to enter the name and description of a JSON structure, used for create and edit.
	 * open() resolves with { name, description }, or null when cancelled.
	 */
	return {

		/**
		 * @param {object} mOptions
		 * @param {string} mOptions.title Dialog title
		 * @param {string} mOptions.confirmText Text of the confirm button
		 * @param {object[]} mOptions.structures Existing structures, for the uniqueness check
		 * @param {string} [mOptions.name] Current name when editing (excluded from the uniqueness check)
		 * @param {string} [mOptions.description] Current description when editing
		 * @param {sap.ui.core.Control} mOptions.owner Control whose models and lifecycle the dialog joins
		 */
		open: function (mOptions) {
			return new Promise(function (resolve) {
				var vResult = null;

				var oNameInput = new Input({
					value: mOptions.name || "",
					placeholder: "Letters and digits only, e.g. SalesOrder",
					required: true,
					maxLength: 64,
					liveChange: validate,
					submit: confirm
				});
				var oDescriptionInput = new TextArea({
					value: mOptions.description || "",
					placeholder: "Optional",
					rows: 2,
					width: "100%"
				});
				var oConfirmButton = new Button({
					text: mOptions.confirmText,
					type: "Emphasized",
					press: confirm
				});

				function validate() {
					var sError = StructureStore.validateName(oNameInput.getValue().trim(), mOptions.structures, mOptions.name);
					// Show "Enter a name" only once the user has typed something
					var bShow = !!sError && oNameInput.getValue() !== "";
					oNameInput.setValueState(bShow ? "Error" : "None");
					oNameInput.setValueStateText(sError || "");
					oConfirmButton.setEnabled(!sError);
					return !sError;
				}

				function confirm() {
					if (!validate()) {
						return;
					}
					vResult = {
						name: oNameInput.getValue().trim(),
						description: oDescriptionInput.getValue().trim()
					};
					oDialog.close();
				}

				var oDialog = new Dialog({
					title: mOptions.title,
					contentWidth: "24rem",
					content: new SimpleForm({
						editable: true,
						layout: "ResponsiveGridLayout",
						labelSpanL: 12, labelSpanM: 12, labelSpanS: 12,
						content: [
							new Label({ text: "Name", labelFor: oNameInput, required: true }),
							oNameInput,
							new Label({ text: "Description", labelFor: oDescriptionInput }),
							oDescriptionInput
						]
					}),
					beginButton: oConfirmButton,
					endButton: new Button({
						text: "Cancel",
						press: function () {
							oDialog.close();
						}
					}),
					initialFocus: oNameInput,
					afterClose: function () {
						oDialog.destroy();
						resolve(vResult);
					}
				});

				mOptions.owner.addDependent(oDialog);
				validate();
				oDialog.open();
			});
		}
	};
});
