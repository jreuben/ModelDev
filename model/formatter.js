sap.ui.define([
	"modeldev/model/StructureStore"
], function (StructureStore) {
	"use strict";

	return {

		isStructureType: function (sType) {
			return StructureStore.isStructureType(sType);
		},

		/** Default values only apply to primitive types (not structures or streams). */
		canHaveDefault: function (sType) {
			return StructureStore.isEdmType(sType) && sType !== "Edm.Stream";
		},

		defaultPlaceholder: function (sType, bArray) {
			if (StructureStore.isStructureType(sType)) {
				return "n/a for structure types";
			}
			if (bArray && sType !== "Edm.Stream") {
				return "Type a value, press Enter";
			}
			switch (sType) {
				case "Edm.Boolean": return "true / false";
				case "Edm.Date": return "YYYY-MM-DD";
				case "Edm.DateTimeOffset": return "YYYY-MM-DDThh:mm:ssZ";
				case "Edm.TimeOfDay": return "hh:mm:ss";
				case "Edm.Duration": return "e.g. PT1H";
				case "Edm.Guid": return "GUID";
				case "Edm.Stream": return "n/a";
				default: return "Default value";
			}
		},

		defaultValueState: function (sType, sValue) {
			return StructureStore.validateDefault(sType, sValue) ? "Error" : "None";
		},

		defaultValueStateText: function (sType, sValue) {
			return StructureStore.validateDefault(sType, sValue) || "";
		},

		fieldCount: function (aFields) {
			return aFields ? aFields.length : 0;
		}
	};
});
