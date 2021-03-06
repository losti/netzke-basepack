{
  bodyStyle     : 'padding:5px 5px 0',
  autoScroll    : true,
  trackResetOnLoad : true,

  initComponent: function(){
    // passing config options to BasicForm is possible via initialConfig only
    // see Ext.form.Panel documentation
    //this.initialConfig = {
      // form tracks it's default field values so they can be reset()
    //  trackResetOnLoad: true,
    //}

    if (!this.bbar && !this.readOnly && !this.preventBbar) this.bbar = {xtype: 'toolbar'}; // an empty bbar by default, so that we can dynamically add buttons

    // Custom error reader. We don't use it to process form values, but rather to normalize the response from the server in case of "real" (iframe) form submit.
    ErrorReader = function(){};

    ErrorReader.prototype.read = function(xhr) {
      var unescapeHTML = function(str) {
        return str.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
      }
      xhr.responseText = unescapeHTML(xhr.responseText.replace(/<pre.*?>/, "").replace("</pre>", ""));
      return {records: [], success: true};
    };

    this.initialConfig.errorReader = new ErrorReader();

    // Now let Ext.form.FormPanel do the rest
    this.callParent(arguments);

    // To inform the parent about the apply event
    this.addEvents('apply', 'cancel');
  },

  afterRender: function(){
    this.callParent();

    // have a record to be displayed?
    if (this.record) {
        this.setFormValues(this.record);
        this.getForm().reset();
    }

    // render in display mode?
    if (this.locked || this.readOnly) this.setReadonlyMode(true);

    //add eventlistener
    this.getForm().on('dirtychange', function(form,dirty,eOpts) {
        this.examineDirtyness(dirty);
    },this);
  },

    examineDirtyness: function(dirty) {
        var tbar = this.child('toolbar');
        if (dirty == true) {
            //change okclear button back to okclear to apply (if we have)
            var buttonToRemove = tbar.child("button[name='okclear']");
            if ( buttonToRemove ) {
                tbar.remove( buttonToRemove );
                tbar.add( this.actions.apply );
            }
        } else {
            //change apply button back to okclear (if we have)
            var buttonToRemove = tbar.child("button[name='apply']");
            if ( buttonToRemove ) {
                tbar.remove( buttonToRemove );
                tbar.add( this.actions.okclear );
            }
        }
    },

  onAddnew: function(){
    this.onApply();
  },

  onEdit: function(){
    this.setReadonlyMode(false);
  },

  onCancel: function(){
    //this function has to be defined upper level
  },

  onOkclear: function(){
    //this function has to be defined upper level
  },

  setResult: function(result){
    //update succeded, we change Addnew button to Okclear
    if (result == true) {
      var tbar = this.child('toolbar');
      var buttonToRemove = tbar.child("button[name='addnew']");
      if ( buttonToRemove ) {
        tbar.remove( buttonToRemove );
        tbar.add( this.actions.okclear );
      }
    }
    this.latestResult = result;
  },

  updateToolbar: function(){
    var tbar = this.child('toolbar');

    if ( this.inReadonlyMode ) {
      //   if the form in readonly mode, remove "Apply" and "Cancel"
      //   buttons from toolbar and add "Edit" button
      var buttonToRemove = tbar.child("button[name='apply']");
      if ( buttonToRemove ) {
        tbar.remove( buttonToRemove );
      }

      var buttonToRemove = tbar.child("button[name='cancel']");
      if ( buttonToRemove ) {
        tbar.remove( buttonToRemove );
      }

      tbar.add( this.actions.edit );

    } else {
      // if the form editable, remove "edit" button and
      // insert "apply" and "cancel" instead

      var buttonIndex = tbar.items.findIndex("name", "edit");
      var buttonToRemove = tbar.items.getAt(buttonIndex);
      if (buttonToRemove) {
        tbar.remove(buttonToRemove);
      }
      tbar.insert( buttonIndex, this.actions.cancel );
      tbar.insert( buttonIndex, this.actions.apply );
    }

    tbar.doLayout();
  },

  onApply: function() {
    if (this.fireEvent('apply', this)) {
      //we get the toolbar to determine if it is a new record in the form or an existing one
      var tbar = this.child('toolbar'),
          buttonToCheck;
      //if this button exist, it is an existing record (not nice but it works)
      if (tbar) buttonToCheck = tbar.child("button[name='apply']");

      var values = this.getForm().getValues();
      for (var fieldName in values) {
        var field = this.getForm().findField(fieldName);

        // TODO: move the following checks to the server side (through the :display_only option)
        // do not submit clean (not dirty) fields if it is a modification
        // 'id' field is always submited
        if (buttonToCheck && !field.isDirty() && fieldName != 'id') {
            delete values[fieldName];
        }

        // do not submit values from disabled fields
        if (!field || field.disabled) {
          delete values[fieldName];
        }

        // do not submit values from read-only association fields
        if (field
          && field.name.indexOf("__") !== -1
          && (field.readOnly || !field.isXType('combobox'))
          && (!field.nestedAttribute) // except for "nested attributes"
        ) {
          delete values[fieldName];
        }

        // do not submit values from displayfields
        if (field.isXType('displayfield')) {
          delete values[fieldName];
        }

        // do not submit displayOnly fields
        if (field.displayOnly) {
          delete values[fieldName];
        }
      }

      // apply mask
      if (!this.applyMaskCmp) this.applyMaskCmp = new Ext.LoadMask(Ext.getBody(), this.applyMask);
      this.applyMaskCmp.show();

      // We must use a different approach when the form is multipart, as we can't use the endpoint
      if (this.fileUpload) {
        this.getForm().submit({ // normal submit
          url: this.endpointUrl("netzke_submit"),
          params: {
            data: Ext.encode(values) // here are the correct values that may be different from display values
          },
          failure: function(form, action){
              this.fireEvent('submitfailure');
              if (this.applyMaskCmp) this.applyMaskCmp.hide();
          },
          success: function(form, action) {
            try {
              var respObj = Ext.decode(action.response.responseText);
              delete respObj.success;
              this.bulkExecute(respObj);
              this.fireEvent('submitsuccess');
            }
            catch(e) {
              Ext.Msg.alert('File upload error', action.response.responseText);
            }
            if (this.applyMaskCmp) this.applyMaskCmp.hide();
          },
          scope: this
        });
      } else {
        this.netzkeSubmit(Ext.apply((this.baseParams || {}), {data:Ext.encode(values)}), function(success){
          if (success) {
            this.fireEvent("submitsuccess");
            if (this.mode == "lockable") this.setReadonlyMode(true);
          };
          if (this.applyMaskCmp) this.applyMaskCmp.hide();
        }, this);
      }
    }
    this.fireEvent('afterApply', this);
  },

  setFormValues: function(values){
    var assocValues = values._meta.associationValues || {};
    for (var assocFieldName in assocValues) {

      var assocField = this.getForm().getFields().filter('name', assocFieldName).first();
      if (assocField.isXType('combobox')) {
        // HACK: using private property 'store' here!
        assocField.store.loadData([[values[assocFieldName], assocValues[assocFieldName]]]);
        delete assocField.lastQuery; // force loading the store next time user clicks the trigger
      } else {
        assocField.setValue(assocValues[assocFieldName]);
        delete values[assocFieldName]; // we don't want this to be set once more below with setValues()
      }
    }

    this.getForm().setValues(values);
  },

  setReadonlyMode: function(onOff, cancel){
    if (this.inReadonlyMode == onOff) return;
    this.getForm().getFields().each(function(i){
      if (i.setReadonlyMode) i.setReadonlyMode(onOff);
    });

    // this.getForm().cleanDestroyed(); // because fields inside of composite fields are not auto-cleaned!
    this.doLayout();
    this.inReadonlyMode = onOff;
    if (this.mode == "lockable") this.updateToolbar();
  },

  // recursively extract field names
  extractFields: function(items){
    Ext.each(items, function(i){
      if (i.items) {this.extractFields(i.items);}
      else if (i.name) {this.fieldNames.push(i.name);}
    }, this);
  },

  applyFormErrors: function(errors) {
    var field;
    Ext.iterate(errors, function(fieldName, message){
      fieldName = fieldName.underscore();
      if ( field = this.getForm().findField(fieldName) || this.getForm().findField(fieldName.replace(/([a-z]+)([0-9])/g, '$1_$2'))) {
        field.markInvalid(message.join('<br/>'));
      }
    }, this);
  }

}