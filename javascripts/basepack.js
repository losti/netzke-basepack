Ext.ns("Netzke.pre");
Ext.ns("Netzke.pre.Basepack");
Ext.ns("Ext.ux.grid");

//Ext.apply(Ext.History, new Ext.util.Observable());

// A convenient passfield
// Ext.netzke.PassField = Ext.extend(Ext.form.TextField, {
//   inputType: 'password'
// });
// Ext.reg('passfield', Ext.netzke.PassField);

// Ext.override(Ext.ux.form.DateTimeField, {
//   format: "Y-m-d",
//   timeFormat: "g:i:s",
//   picker: {
//     minIncremenet: 15
//   }
// });

// ComboBox that gets options from the server (used in both grids and panels)
Ext.define('Ext.netzke.ComboBox', {
  extend        : 'Ext.form.field.ComboBox',
  alias         : 'widget.netzkeremotecombo',
  editable      : false,
  valueField    : 'field1',
  displayField  : 'field2',
  triggerAction : 'all',
  // WIP: Breaking - should not be 'true' if combobox is not editable
  // typeAhead     : true,

  initComponent : function(){
    var modelName = this.parentId + "_" + this.name;

    Ext.define(modelName, {
        extend: 'Ext.data.Model',
        fields: ['field1', 'field2']
    });

    var store = new Ext.data.Store({
      model: modelName,
      proxy: {
        type: 'direct',
        directFn: Netzke.providers[this.parentId].getComboboxOptions,
        reader: {
          type: 'array',
          root: 'data'
        }
      }
    });

    //we want to autoexpand on focus, since we are not editable
    this.on('focus', function() {
      //if (this.readOnly) return false;
      this.onTriggerClick();
    },this);
    // TODO: find a cleaner way to pass this.name to the server
    store.on('beforeload', function(self, params) {
      //if (this.readOnly) return false;
      params.params.column = this.name;
    },this);
    //prevent collapse after store load
    if (this.preventFirstCollapse) {
        store.on('load', function(store, records, suc, op, eOpts) {
          this.prevCollapse = true;
        },this);
    }

    // insert a selectable "blank line" which allows to remove the associated record
    if (this.blankLine) {
      store.on('load', function(self, params) {
        // append a selectable "empty line" which will allow remove the association
        self.insert(0,Ext.create(modelName, {field1: -1, field2: this.blankLine}));
      }, this);
    }

    // If inline data was passed (TODO: is this actually working?)
    if (this.store) store.loadData({data: this.store});

    this.store = store;

    this.callParent();
  },

  collapse: function(){
    // HACK: do not hide dropdown menu while loading items
    if( !this.prevCollapse) {
        this.callParent();
    } else {
        this.prevCollapse = false;
    }
  }
});

Ext.util.Format.mask = function(v){
  return "********";
};

// Ext.netzke.JsonField = Ext.extend(Ext.form.TextField, {
//   validator: function(value) {
//     try{
//       var d = Ext.decode(value);
//       return true;
//     } catch(e) {
//       return "Invalid JSON"
//     }
//   }
//
//   ,setValue: function(value) {
//     this.setRawValue(Ext.encode(value));
//   }
//
// });
//
// Ext.reg('jsonfield', Ext.netzke.JsonField);
//
// WIP: todo - rewrite Ext.lib calls below
// Ext.grid.HeaderDropZone.prototype.onNodeDrop = function(n, dd, e, data){
//     var h = data.header;
//     if(h != n){
//         var cm = this.grid.colModel;
//         var x = Ext.lib.Event.getPageX(e);
//         var r = Ext.lib.Dom.getRegion(n.firstChild);
//         var pt = (r.right - x) <= ((r.right-r.left)/2) ? "after" : "before";
//         var oldIndex = this.view.getCellIndex(h);
//         var newIndex = this.view.getCellIndex(n);
//         if(pt == "after"){
//             newIndex++;
//         }
//         if(oldIndex < newIndex){
//             newIndex--;
//         }
//         cm.moveColumn(oldIndex, newIndex);
//         return true;
//     }
//     return false;
// };
//
//
// Ext.ns('Ext.ux.form');

Ext.define('Ext.ux.form.TriCheckbox', {
  extend: 'Ext.form.field.ComboBox',
  alias: 'widget.tricheckbox',
  store: [[true, "Yes"], [false, "No"]],
  forceSelection: true
});

// Enabling checkbox submission when unchecked
// TODO: it would be nice to standardize return values
//  because currently checkboxes return "on", if checked,
//  and boolean 'false' otherwise. It's not nice
//  MAV
//  TODO: maybe we should simply initialize 'uncheckedValue' somewhere else,
//  instead
Ext.override( Ext.form.field.Checkbox, {
  getSubmitValue: function() {
    return this.callOverridden() || false; // 'off';
  }
});

/* We were missing the 'load' event on proxy, implementing it ourselves */
/*Ext.override(Ext.data.proxy.Server, {
  constructor: function() {
    this.addEvents('load');
    this.callOverridden([arguments]);
  },

  processResponse: function(success, operation, request, response, callback, scope){
    this.callOverridden(arguments);
    this.fireEvent('load', this, response, operation);
  }
});*/