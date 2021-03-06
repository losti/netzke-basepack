{
  trackMouseOver: true,
  loadMask: true,
  autoScroll: true,

  componentLoadMask: {msg: "Betöltés..."},
  deleteMaskMsg: "Deleting...",
  saveMaskMsg: "Saving...",
  multiSelect: true,

  initComponent: function(){
    var metaColumn;
    var fields = []; // field configs for the underlying data model

    this.plugins = this.plugins || [];
    this.features = this.features || [];

    // Enable filters feature
    this.features.push({
      encode: true,
      ftype: 'filters'
    });

    // Run through columns and set up different configuration for each
    Ext.each(this.columns, function(c, i){

      this.normalizeRenderer(c);

      // Build the field configuration for this column
      var fieldConfig = {name: c.name, defaultValue: c.defaultValue};

      if (c.name !== '_meta') fieldConfig.type = this.fieldTypeForAttrType(c.attrType); // field type (grid editors need this to function well)

      //we don't want to receive not existing 0-s
      if (c.attrType == 'integer' || c.attrType == 'decimal') fieldConfig.useNull = true;
      if (c.convert) {
          fieldConfig.convert =  this.normalizeConvert(c);
      }

      if (c.attrType == 'datetime') {
        fieldConfig.dateFormat = 'Y-m-d H:i:s'; // in this format we receive dates from the server
        c.format = 'Y-m-d H:i'; // in this format we display

        if (!c.renderer) {
          // format in which the data will be rendered; if c.format is nil, Ext.Date.defaultFormat extended with time will be used
          c.renderer = Ext.util.Format.dateRenderer(c.format || Ext.Date.defaultFormat + " H:i:s");
        }
      };

      fields.push(fieldConfig);

      // We will not use meta columns as actual columns (not even hidden) - only to create the records
      if (c.meta) {
        metaColumn = c;
        return;
      }

      // if comboboxOptions are provided, we render a combobox instead of textfield
      // if (c.comboboxOptions && c.editor.xtype === "textfield") {
      //   c.editor = {xtype: "combobox", options: c.comboboxOptions.split('\\n')}
      // }


      // Set rendeder for association columns (the one displaying associations by the specified method instead of id)
      if (c.assoc) {
        c.emptyText = c.emptyText || "---";

        // Editor for association column
        c.editor = Ext.apply({
          parentId: this.id,
          emptyText: c.emptyText,
          name: c.name,
          preventFirstCollapse: true
        }, c.editor);

        // Renderer for association column
        this.normalizeAssociationRenderer(c);
      }

      if (c.editor) {
        Ext.applyIf(c.editor, {selectOnFocus: true});
      }

      // Setting the default filter type
      if (c.filterable && !c.filter) {
        c.filter = {type: this.fieldTypeForAttrType(c.attrType)};
      }

      // setting dataIndex
      c.dataIndex = c.name;

      // bugfix for gridpanel cell click event
      if (c.tdCls) {
        c.tdCls = c.tdCls+' eventbugfix_'+c.name;
      } else {
        c.tdCls = 'eventbugfix_'+c.name;
      }

    }, this);

    /* ... and done with the columns */

    // Define the model
    Ext.define(this.id, {
      extend: 'Ext.data.Model',
      idProperty: this.pri, // Primary key
      fields: fields
    });

    // After we created the record (model), we can get rid of the meta column
    Ext.Array.remove(this.columns, metaColumn);

    // Prepare column model config with columns in the correct order; columns out of order go to the end.
    var colModelConfig = [];
    var columns = this.columns;

    Ext.each(this.columnsOrder, function(c) {
      var mainColConfig;
      Ext.each(this.columns, function(oc) {
        if (c.name === oc.name) {
          mainColConfig = Ext.apply({}, oc);
          return false;
        }
      });

      colModelConfig.push(Ext.apply(mainColConfig, c));
    }, this);

    // We don't need original columns any longer
    delete this.columns;

    // ... instead, define own column model
    this.columns = colModelConfig;

    var reader = Ext.create('Ext.data.reader.Array', {root: 'data', totalProperty: 'total'});

    // DirectProxy that uses our Ext.direct provider
    var proxy = Ext.create('Ext.data.proxy.Direct', {
      directFn: Netzke.providers[this.id].getData,
      reader: reader,
      listeners: {
        exception: {
          fn: this.loadExceptionHandler,
          scope: this
        },
        load: { // Netzke-introduced event; this will also be fired when an exception occurs.
          fn: function(proxy, response, operation) {
            // besides getting data into the store, we may also get commands to execute
            response = response.result;
            if (response) { // or did we have an exception?
              Ext.each(['data', 'total', 'success'], function(property){delete response[property];});
              this.bulkExecute(response);
            }
          },
          scope: this
        }
      }
    });

    this.store = Ext.create('Ext.data.Store', {
      model: this.id,
      proxy: proxy,
      pruneModifiedRecords: true,
      remoteSort: (!this.remoteSort && this.remoteSort == false)?false:true,
      pageSize: this.rowsPerPage
    });

    if (this.inlineData) this.store.loadRawData(this.inlineData);

    // Drag'n'Drop
    if (this.enableRowsReordering){
      this.ddPlugin = new Ext.ux.dd.GridDragDropRowOrder({
        scrollable: true // enable scrolling support (default is false)
      });
      this.plugins.push(this.ddPlugin);
    }

    // Cell editing
    if (!this.prohibitUpdate) {
      me = Ext.create('Ext.grid.plugin.CellEditing', {pluginId: 'celleditor', clicksToEdit: 2});
      this.plugins.push(me);
      //remove celldblclick event, because we have to use itemmousedown event
      //other grid mouse events are stochastic (useless)
      //itemmousedown event handling is not implemented in basepack
      this.on('afterrender',function() {
        me = this.getPlugin('celleditor');
        me.mun(me.view, 'celldblclick');
      }, this);
    }

    // Toolbar
    this.dockedItems = this.dockedItems || [];
    if (this.enablePagination) {
      this.dockedItems.push({
        xtype: 'pagingtoolbar',
        itemId: 'paging',
        dock: 'bottom',
        store: this.store,
        items: this.bbar && ["-"].concat(this.bbar) // append the old bbar.
      });
    } else if (this.bbar) {
      this.dockedItems.push({
        xtype: 'toolbar',
        dock: 'bottom',
        items: this.bbar
      });
    }


    delete this.bbar;

    // Now let Ext.grid.EditorGridPanel do the rest (original initComponent)
    this.callParent();

    // Context menu
    if (this.contextMenu) {
      this.on('itemcontextmenu', this.onItemContextMenu, this);
    }

    // Disabling/enabling editInForm button according to current selection
    if (this.enableEditInForm && !this.prohibitUpdate) {
      this.getSelectionModel().on('selectionchange', function(selModel, selected){
        var disabled;
        if (selected.length === 0) { // empty?
          disabled = true;
        } else {
          // Disable "edit in form" button if new record is present in selection
          Ext.each(selected, function(r){
            if (r.isNew) { disabled = true; return false; }
          });
        };
        this.actions.editInForm.setDisabled(disabled);
      }, this);
    }

    // Process selectionchange event to enable/disable actions
    this.getSelectionModel().on('selectionchange', function(selModel){
      if (this.actions.del) this.actions.del.setDisabled(!selModel.hasSelection() || this.prohibitDelete);
      if (this.actions.edit) this.actions.edit.setDisabled(selModel.getCount() != 1 || this.prohibitUpdate);
    }, this);

    // Drag n Drop event
    if (this.enableRowsReordering){
      this.ddPlugin.on('afterrowmove', this.onAfterRowMove, this);
    }

    // WIP: GridView
    this.getView().getRowClass = this.defaultGetRowClass;

    // When starting editing as assocition column, pre-load the combobox store from the meta column, so that we don't see the real value of this cell (the id of the associated record), but rather the associated record by the configured method.
    this.on('beforeedit', function(editor, e){
        if (e.column.assoc && e.record.get('_meta')) {
            var c = e.column,
            combo = c.getEditor(),
            store = combo.store,
            id = e.record.get(e.field);

            if (id === 0 && -1 == store.find('field1', 0)) store.loadData([[0, c.emptyText]], true);

            if (id && -1 == store.find('field1', id)) {
                store.loadData([[e.record.get(e.field), e.record.get('_meta').associationValues[e.field]]], true);
            }

        }
    }, this);

    this.on('afterrender', function() {
      // Persistence-related events (afterrender to avoid blank event firing on render)
      if (this.persistence) {
        // Inform the server part about column operations
        this.on('columnresize', this.onColumnResize, this);
        this.on('columnmove', this.onColumnMove, this);
        this.on('columnhide', this.onColumnHide, this);
        this.on('columnshow', this.onColumnShow, this);
      }
    }, this);
  },

  fieldTypeForAttrType: function(attrType){
    var map = {
      integer   : 'int',
      decimal   : 'float',
      datetime  : 'date',
      date      : 'date',
      string    : 'string',
      text      : 'string',
      'boolean' : 'boolean'
    };
    return map[attrType] || 'string';
  },

  update: function(){
    this.store.load();
  },

  loadStoreData: function(data){
    var dataRecords = this.getStore().getProxy().getReader().read(data);
    this.getStore().loadData(dataRecords.records);
    Ext.each(['data', 'total', 'success'], function(property){delete data[property];}, this);
    this.bulkExecute(data);
  },

  // Tries editing the first editable (i.e. not hidden, not read-only) sell
  tryStartEditing: function(r){
    var editableIndex = 0;
    Ext.each(this.initialConfig.columns, function(c){
      // skip columns that cannot be edited
      if (!(c.hidden == true || c.editable == false || !c.editor || c.attrType == 'boolean')) {
        return false;
      }
      editableIndex++;
    });

    if (editableIndex < this.initialConfig.columns.length) {this.getPlugin('celleditor').startEdit(r, this.columns[editableIndex]);}
  },

  // Called by the server side to update newly created records
  updateNewRecords: function(records){
    this.updateRecords(records);
  },

  // Called by the server side to update modified records
  updateModRecords: function(records){
    this.updateRecords(records, true);
  },

  // Updates modified or newly created records, by record ID
  // Example of the records argument (updated columns):
  //   {1098 => [1, 'value1', 'value2'], 1099 => [2, 'value1', 'value2']}
  // Example of the records argument (new columns, id autogenerated by Ext):
  //   {"ext-record-200" => [1, 'value1', 'value2']}
  updateRecords: function(records, mod){
    if (!mod) {mod = false;}
    var modRecordsInGrid = [].concat(this.store.getUpdatedRecords()); // there must be a better way to clone an array...
    // replace arrays of data in the args object with Ext.data.Record objects
    for (var k in records){
      records[k] = this.getStore().getProxy().getReader().read({data:[records[k]]}).records[0];
    }
    // for each new record write the data returned by the server, and commit the record
    Ext.each(modRecordsInGrid, function(recordInGrid){
      if (mod ^ recordInGrid.isNew) {
        // if record is new, we access its id by "id", otherwise, the id is in the primary key column
        var recordId = recordInGrid.getId();
        // new data that the server sent us to update this record (identified by the id)
        var newData =  records[recordId];

        if (newData){
          for (var k in newData.data){
            recordInGrid.set(k, newData.get(k));
          }

          recordInGrid.isNew = false;
          recordInGrid.commit();
        }

      }
    }, this);

    // clear the selections
    this.getSelectionModel().clearSelections();

    // check if there are still records with errors
    var modRecords = this.store.getUpdatedRecords();
    if (modRecords.length == 0) {
      // if all records are accepted, reload the grid (so that eventual order/filtering is correct)
      this.store.load();

      // ... and set default getRowClass function
      this.getView().getRowClass = this.defaultGetRowClass;
    } else {
      this.getView().getRowClass = function(r){
        return r.dirty ? "grid-dirty-record" : ""
      }
    }

    this.getView().refresh();
    this.getSelectionModel().fireEvent('selectionchange', this.getSelectionModel());
  },

  defaultGetRowClass: function(r){
    return r.isNew ? "grid-dirty-record" : ""
  },

  selectFirstRow: function(){
    this.getSelectionModel().suspendEvents();
    this.getSelectionModel().selectRow(0);
    this.getSelectionModel().resumeEvents();
  },

  // Normalizes the renderer for a column.
  // Renderer may be:
  // 1) a string that contains the name of the function to be used as renderer.
  // 2) an array, where the first element is the function name, and the rest - the arguments
  // that will be passed to that function along with the value to be rendered.
  // The function is searched in the following objects: 1) Ext.util.Format, 2) this.
  // If not found, it is simply evaluated. Handy, when as renderer we receive an inline JS function,
  // or reference to a function in some other scope.
  // So, these will work:
  // * "uppercase"
  // * ["ellipsis", 10]
  // * ["substr", 3, 5]
  // * "myRenderer" (if this.myRenderer is a function)
  // * ["Some.scope.Format.customRenderer", 10, 20, 30] (if Some.scope.Format.customRenderer is a function)
  // * "function(v){ return 'Value: ' + v; }"
  normalizeRenderer: function(c) {
    if (!c.renderer) return;

    var name, args = [];

    if ('string' === typeof c.renderer) {
      name = c.renderer.camelize(true);
    } else {
      name = c.renderer[0];
      args = c.renderer.slice(1);
      c.rendererArgs = args; //we put the arguments into the initial config
    }

    // First check whether Ext.util.Format has it
    if (Ext.isFunction(Ext.util.Format[name])) {
       c.renderer = Ext.Function.bind(Ext.util.Format[name], this, args, 1);
    } else if (Ext.isFunction(this[name])) {
      // ... then if our own class has it
      c.renderer = Ext.Function.bind(this[name], this, args, 1);
    } else {
      // ... and, as last resort, evaluate it (allows passing inline javascript function as renderer)
      eval("c.renderer = " + c.renderer + ";");
    }
  },

  // Normalizes the convert function for a column.
  normalizeConvert: function(c) {
    if (!c.convert) return;

    var name, args = [];

    if ('string' === typeof c.convert) {
      name = c.convert;
    } else {
      name = c.convert[0];
      args = c.convert.slice(1);
    }

    if (args.length > 0) {
        return Ext.Function.bind(window[name], this, args, 1);
    } else {
        return window[name];
    }
  },

  /*
  Set a renderer that displayes association values instead of association record ID.
  The association values are passed in the meta-column under associationValues hash.
  */
  normalizeAssociationRenderer: function(c) {
    c.scope = this;
    var passedRenderer = c.renderer; // renderer we got from normalizeRenderer
    c.renderer = function(value, a, r, ri, ci){
      var column = this.headerCt.items.getAt(ci),
          editor = column.getEditor && column.getEditor(),
          recordFromStore = editor && editor.isXType('combobox') && editor.getStore().findRecord('field1', value, 0, false, false, true),
          renderedValue;

      if (recordFromStore) {
        renderedValue = recordFromStore.get('field2');
      } else if (c.assoc && r.get('_meta')) {
        renderedValue = r.get('_meta').associationValues[c.name] || c.emptyText || value;
      } else {
        renderedValue = value;
      }

      return passedRenderer ? passedRenderer.call(this, renderedValue, r) : renderedValue;
    };
  }
}
