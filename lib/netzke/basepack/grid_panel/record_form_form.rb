module Netzke
  module Basepack
    class GridPanel < Netzke::Base
      class RecordFormForm < FormPanel

        js_properties :bbar => [:cancel.action,'->',:ok.action]

        action :ok do
          { :text => I18n.t('netzke.basepack.grid_panel.record_form_window.actions.ok'),
            :tooltip => '',
            :icon => :tick
          }
        end

        action :cancel do
          { :text => I18n.t('netzke.basepack.grid_panel.record_form_window.actions.cancel'),
            :tooltip => '',
            :icon => :cross
          }
        end

        js_method :on_ok, <<-JS
          function(params){
            this.ownerCt.items.first().onApply();
          }
        JS

        js_method :on_cancel, <<-JS
          function(params){
            this.ownerCt.close();
          }
        JS

        js_method :on_okclear, <<-JS
          function(params){
            this.ownerCt.close();
          }
        JS
      end
    end
  end
end
