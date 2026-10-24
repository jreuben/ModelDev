sap.ui.define([], function () {
	"use strict";

	var STORAGE_KEY = "modeldev.jsonStructures";
	var NAME_PATTERN = /^[A-Za-z0-9]+$/;

	/** OData V4 primitive (EDM) types offered in the type list. */
	var EDM_TYPES = [
		"Edm.Binary",
		"Edm.Boolean",
		"Edm.Byte",
		"Edm.Date",
		"Edm.DateTimeOffset",
		"Edm.Decimal",
		"Edm.Double",
		"Edm.Duration",
		"Edm.Guid",
		"Edm.Int16",
		"Edm.Int32",
		"Edm.Int64",
		"Edm.SByte",
		"Edm.Single",
		"Edm.Stream",
		"Edm.String",
		"Edm.TimeOfDay"
	];

	var NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
	var INTEGER = /^[+-]?\d+$/;

	function intRange(iMin, iMax) {
		return function (s) {
			if (!INTEGER.test(s)) {
				return "Enter a whole number";
			}
			var i = Number(s);
			return i < iMin || i > iMax ? "Enter a value between " + iMin + " and " + iMax : null;
		};
	}

	function pattern(rPattern, sMessage) {
		return function (s) {
			return rPattern.test(s) ? null : sMessage;
		};
	}

	/** Default-value validators per EDM type; each returns an error text or null. */
	var VALIDATORS = {
		"Edm.Binary": pattern(/^[A-Za-z0-9+/]*={0,2}$/, "Enter a Base64 encoded value"),
		"Edm.Boolean": pattern(/^(true|false)$/, "Enter true or false"),
		"Edm.Byte": intRange(0, 255),
		"Edm.Date": pattern(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD"),
		"Edm.DateTimeOffset": pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/,
			"Enter a timestamp as YYYY-MM-DDThh:mm:ssZ"),
		"Edm.Decimal": pattern(NUMBER, "Enter a number"),
		"Edm.Double": pattern(NUMBER, "Enter a number"),
		"Edm.Duration": pattern(/^-?P(?=\d|T\d)(\d+D)?(T(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/, "Enter a duration such as P1DT2H30M"),
		"Edm.Guid": pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
			"Enter a GUID such as 01234567-89ab-cdef-0123-456789abcdef"),
		"Edm.Int16": intRange(-32768, 32767),
		"Edm.Int32": intRange(-2147483648, 2147483647),
		"Edm.Int64": pattern(INTEGER, "Enter a whole number"),
		"Edm.SByte": intRange(-128, 127),
		"Edm.Single": pattern(NUMBER, "Enter a number"),
		"Edm.TimeOfDay": pattern(/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/, "Enter a time as hh:mm:ss")
	};

	/** Placeholder values used when building a sample instance and no default is set. */
	var SAMPLE_VALUES = {
		"Edm.Binary": "",
		"Edm.Boolean": false,
		"Edm.Date": "2026-01-01",
		"Edm.DateTimeOffset": "2026-01-01T00:00:00Z",
		"Edm.Duration": "PT0S",
		"Edm.Guid": "00000000-0000-0000-0000-000000000000",
		"Edm.Stream": null,
		"Edm.String": "",
		"Edm.TimeOfDay": "00:00:00"
	};
	var NUMERIC_TYPES = ["Edm.Byte", "Edm.Decimal", "Edm.Double", "Edm.Int16", "Edm.Int32", "Edm.Int64", "Edm.SByte", "Edm.Single"];

	var SAMPLE_DATA = [
		{
			name: "Address",
			description: "Postal address",
			fields: [
				{ key: "street", type: "Edm.String", defaultValue: "", isArray: false },
				{ key: "city", type: "Edm.String", defaultValue: "", isArray: false },
				{ key: "postalCode", type: "Edm.String", defaultValue: "", isArray: false },
				{ key: "country", type: "Edm.String", defaultValue: "US", isArray: false }
			]
		},
		{
			name: "Customer",
			description: "Customer master data",
			fields: [
				{ key: "id", type: "Edm.Guid", defaultValue: "", isArray: false },
				{ key: "name", type: "Edm.String", defaultValue: "", isArray: false },
				{ key: "active", type: "Edm.Boolean", defaultValue: "true", isArray: false },
				{ key: "addresses", type: "Address", defaultValue: [], isArray: true },
				{ key: "tags", type: "Edm.String", defaultValue: ["regular"], isArray: true }
			]
		},
		{
			name: "Order",
			description: "Sales order header",
			fields: [
				{ key: "orderId", type: "Edm.Int32", defaultValue: "", isArray: false },
				{ key: "customer", type: "Customer", defaultValue: "", isArray: false },
				{ key: "createdAt", type: "Edm.DateTimeOffset", defaultValue: "", isArray: false },
				{ key: "total", type: "Edm.Decimal", defaultValue: "0", isArray: false }
			]
		}
	];

	function clone(o) {
		return JSON.parse(JSON.stringify(o));
	}

	function findStructure(aStructures, sName) {
		for (var i = 0; i < aStructures.length; i++) {
			if (aStructures[i].name === sName) {
				return aStructures[i];
			}
		}
		return null;
	}

	var StructureStore = {

		EDM_TYPES: EDM_TYPES,

		isEdmType: function (sType) {
			return EDM_TYPES.indexOf(sType) !== -1;
		},

		/** A type that is not an EDM type refers to another JSON structure. */
		isStructureType: function (sType) {
			return !!sType && !StructureStore.isEdmType(sType);
		},

		/**
		 * Checks a structure name; returns an error text or null.
		 * Names must be alphanumeric and unique (ignoring case) among aStructures, except sOwnName.
		 */
		validateName: function (sName, aStructures, sOwnName) {
			if (!sName) {
				return "Enter a name";
			}
			if (!NAME_PATTERN.test(sName)) {
				return "Use letters A-Z, a-z and digits 0-9 only";
			}
			var sLower = sName.toLowerCase();
			var bTaken = aStructures.some(function (oStructure) {
				return oStructure.name !== sOwnName && oStructure.name.toLowerCase() === sLower;
			});
			return bTaken ? "A JSON structure named \"" + sName + "\" already exists" : null;
		},

		/**
		 * Checks a default value against its EDM type; returns an error text or null.
		 * Array fields hold a list of values; the first invalid one is reported.
		 */
		validateDefault: function (sType, vValue) {
			if (Array.isArray(vValue)) {
				for (var i = 0; i < vValue.length; i++) {
					var sError = StructureStore.validateDefault(sType, vValue[i]);
					if (sError) {
						return "\"" + vValue[i] + "\": " + sError;
					}
				}
				return null;
			}
			if (vValue === undefined || vValue === null || vValue === "") {
				return null;
			}
			var fnValidate = VALIDATORS[sType];
			return fnValidate ? fnValidate(String(vValue)) : null;
		},

		/**
		 * Converts a default value to the shape a field needs:
		 * a list of strings for array fields, a single string otherwise.
		 */
		convertDefault: function (vValue, bArray) {
			var aValues = (Array.isArray(vValue) ? vValue : [vValue]).filter(function (v) {
				return v !== undefined && v !== null && v !== "";
			}).map(String);
			return bArray ? aValues : (aValues[0] || "");
		},

		/**
		 * In the UI model a field keeps its single default in "defaultValue" (bound to an Input)
		 * and its array defaults in "defaultValues" (bound to MultiInput tokens).
		 * Returns both properties for vValue, filled according to bArray.
		 */
		splitDefault: function (vValue, bArray) {
			return {
				defaultValue: bArray ? "" : StructureStore.convertDefault(vValue, false),
				defaultValues: bArray ? StructureStore.convertDefault(vValue, true) : []
			};
		},

		/** Names of the structures that use sName as the type of one of their keys. */
		getUsages: function (aStructures, sName) {
			return aStructures.filter(function (oStructure) {
				return oStructure.name !== sName && oStructure.fields.some(function (oField) {
					return oField.type === sName;
				});
			}).map(function (oStructure) {
				return oStructure.name;
			});
		},

		load: function () {
			try {
				var sStored = window.localStorage.getItem(STORAGE_KEY);
				if (sStored) {
					return StructureStore.normalize(JSON.parse(sStored));
				}
			} catch (e) {
				// Unreadable or invalid storage falls back to the sample data
			}
			return StructureStore.normalize(clone(SAMPLE_DATA));
		},

		save: function (aStructures) {
			try {
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify(StructureStore.toPlain(aStructures)));
			} catch (e) {
				// Storage unavailable (private mode, quota): edits stay in memory for this session
			}
		},

		/** Copy containing only the persisted properties; "defaultValue" is a list for array fields. */
		toPlain: function (aStructures) {
			return aStructures.map(function (oStructure) {
				return {
					name: oStructure.name,
					description: oStructure.description || "",
					fields: oStructure.fields.map(function (oField) {
						return {
							key: oField.key,
							type: oField.type,
							defaultValue: oField.isArray
								? StructureStore.convertDefault(oField.defaultValues, true)
								: StructureStore.convertDefault(oField.defaultValue, false),
							isArray: !!oField.isArray
						};
					})
				};
			});
		},

		/**
		 * Validates imported or stored data and returns a clean copy in the shape of the UI model.
		 * Accepts an array of structures or an object { structures: [...] }; throws an Error on invalid data.
		 */
		normalize: function (vData) {
			var aRaw = Array.isArray(vData) ? vData : vData && vData.structures;
			if (!Array.isArray(aRaw)) {
				throw new Error("Expected an array of JSON structures or an object with a \"structures\" array");
			}
			var aResult = [];
			aRaw.forEach(function (oRaw, i) {
				if (!oRaw || typeof oRaw !== "object") {
					throw new Error("Entry " + (i + 1) + " is not an object");
				}
				var sName = String(oRaw.name || "");
				var sError = StructureStore.validateName(sName, aResult);
				if (sError) {
					throw new Error("Entry " + (i + 1) + ": " + sError);
				}
				aResult.push({
					name: sName,
					description: oRaw.description ? String(oRaw.description) : "",
					fields: (Array.isArray(oRaw.fields) ? oRaw.fields : []).map(function (oField) {
						var bArray = !!(oField && oField.isArray);
						var oDefaults = StructureStore.splitDefault(oField && oField.defaultValue, bArray);
						return {
							key: String(oField && oField.key || ""),
							type: String(oField && oField.type || "Edm.String"),
							defaultValue: oDefaults.defaultValue,
							defaultValues: oDefaults.defaultValues,
							isArray: bArray
						};
					})
				});
			});
			aResult.forEach(function (oStructure) {
				oStructure.fields.forEach(function (oField) {
					if (!StructureStore.isEdmType(oField.type) && !findStructure(aResult, oField.type)) {
						throw new Error("\"" + oStructure.name + "." + oField.key + "\" has unknown type \"" + oField.type + "\"");
					}
				});
			});
			return aResult;
		},

		/**
		 * Tree nodes describing structure sName, expanding nested structure types.
		 * Each node: { text, type, icon, structure, nodes }. Circular references are not expanded.
		 */
		buildTree: function (aStructures, sName, aVisited) {
			var oStructure = findStructure(aStructures, sName);
			if (!oStructure) {
				return [];
			}
			aVisited = (aVisited || []).concat(sName);
			return oStructure.fields.map(function (oField) {
				var bStructure = StructureStore.isStructureType(oField.type);
				var bCircular = bStructure && aVisited.indexOf(oField.type) !== -1;
				var sType = oField.type + (oField.isArray ? "[]" : "");
				return {
					text: (oField.key || "(no key)") + " : " + sType + (bCircular ? " (circular)" : ""),
					icon: bStructure ? "sap-icon://tree" : (oField.isArray ? "sap-icon://list" : "sap-icon://document-text"),
					nodes: bStructure && !bCircular ? StructureStore.buildTree(aStructures, oField.type, aVisited) : []
				};
			});
		},

		/** Builds an example JSON instance of structure sName using defaults or type placeholders. */
		buildSample: function (aStructures, sName, aVisited) {
			var oStructure = findStructure(aStructures, sName);
			if (!oStructure) {
				return null;
			}
			aVisited = (aVisited || []).concat(sName);
			var oResult = {};
			oStructure.fields.forEach(function (oField) {
				if (!oField.key) {
					return;
				}
				var vValue;
				if (StructureStore.isStructureType(oField.type)) {
					vValue = aVisited.indexOf(oField.type) === -1
						? StructureStore.buildSample(aStructures, oField.type, aVisited) : null;
				} else if (oField.isArray && oField.defaultValues && oField.defaultValues.length) {
					// Array with default values: the sample holds exactly those values
					oResult[oField.key] = oField.defaultValues.map(function (sValue) {
						return StructureStore.sampleValue(oField.type, sValue);
					});
					return;
				} else {
					vValue = StructureStore.sampleValue(oField.type, oField.isArray ? "" : oField.defaultValue);
				}
				oResult[oField.key] = oField.isArray ? (vValue === null ? [] : [vValue]) : vValue;
			});
			return oResult;
		},

		sampleValue: function (sType, sDefault) {
			var bHasDefault = sDefault !== undefined && sDefault !== null && sDefault !== "";
			if (NUMERIC_TYPES.indexOf(sType) !== -1) {
				// Int64 and Decimal stay strings so large/precise values are not rounded
				if (sType === "Edm.Int64" || sType === "Edm.Decimal") {
					return bHasDefault ? String(sDefault) : "0";
				}
				return bHasDefault && !isNaN(Number(sDefault)) ? Number(sDefault) : 0;
			}
			if (sType === "Edm.Boolean") {
				return bHasDefault ? sDefault === "true" : false;
			}
			if (bHasDefault) {
				return sDefault;
			}
			return SAMPLE_VALUES.hasOwnProperty(sType) ? SAMPLE_VALUES[sType] : "";
		}
	};

	return StructureStore;
});
