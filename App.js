Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [
            { xtype: 'container', itemId: 'table_box' }
        ],
    our_hash: {}, /* key is object id, content is the story from our project associated with that object id */
    other_hash: {}, /* key is object id, content is the story associated with that object id */
    timebox_hash: {}, /* key is object id of iteration or release. Changed both to have EndDate */
    launch: function() {
        var me = this;
    	me._getSuccessors();
    },
    log: function( msg ) {
    	var me = this;
//    	if ( ( typeof(msg) == "object" ) && ( msg.length ) ) {
//    		Ext.Array.each( msg, function( one_msg ) { me.log( one_msg ); } );
//    	} else {
    		window.console && console.log( new Date(), msg );
//    	}
    },
    _getSuccessors: function() {
    	var me  = this;
    	Ext.create('Rally.data.lookback.SnapshotStore',{
    		autoLoad: true,
    		limit: 1000,
    		fetch: ['Name','_ItemHierarchy','Successors', 'ScheduleState', 'Project', 'Iteration', 'Release' ],
            hydrate: [ 'ScheduleState' ],
    		filters: [ {
	        	  property: '__At',
	        	  operator: '=',
	        	  value: 'current'
	          },
	          {
	        	  property: 'Successors',
	        	  operator: '!=',
	        	  value: null
	          },
	          {
	        	  property: '_ProjectHierarchy',
	        	  operator: '=',
	        	  value: me.getContext().getProject().ObjectID
	          }],
    		listeners: {
    			load: function( store, data, success ) {
    				me._createRowPerDependency( "Successors", data );
    			}
    		}
    	});
    },
    _createRowPerDependency: function( type, data ) {
        var me = this;
        me.log( [ "got " + type, data.length ] );
        me.log(data);
        var number_of_items_with_dependencies = data.length;
        var rows = [];
        for ( var i=0; i<number_of_items_with_dependencies; i++ ) {
            var dependent_ids = data[i].get(type);
            me.log( [ type + "s", dependent_ids ] );
            me.our_hash[ data[i].get('ObjectID') ] = data[i].data;
            
            for ( var j=0; j< dependent_ids.length; j++ ) {
		        rows.push({
		            direction: 'Provides',
		            project: 'tbd',
		            name: data[i].get('Name'),
		            schedule_state: data[i].get('ScheduleState'),
		            release: data[i].get('Release'),
		            iteration: data[i].get('Iteration'),
                    iteration_name: "",
		            release_date: null,
		            iteration_date: null,
                    other_id: dependent_ids[j],
		            other_project: 'tbd',
		            other_name: 'tbd',
		            other_schedule_state: 'tbd',
		            other_release: null,
		            other_iteration: null,
		            other_release_date: null,
		            other_iteration_date: null,
		            tags: ''
		        });
            }
        }
        me.log( ["rows",rows, "our_hash", me.our_hash ] );
        me._getTimeboxes(type, rows);
    },
    _getTimeboxes: function( type, rows ) {
        var me = this;
        me.log( "_getTimeboxes: " + type );
        var item_length = rows.length;
        
        var query = null;
        for ( var i=0;i<item_length; i++ ) {
            if ( rows[i].release ) {
                var single_query = Ext.create('Rally.data.QueryFilter', {
                   property: 'ObjectID',
                   operator: '=',
                   value: rows[i].release
                });
                if ( ! query ) {
                    query = single_query;
                } else {
                    query = query.or( single_query );
                }
            }
        }
        if ( query ) {
            Ext.create('Rally.data.WsapiDataStore',{
                autoLoad: true,
                model: 'Release',
                fetch: [ 'ObjectID', 'ReleaseDate' ],
                filters: query,
                listeners: {
                    load: function( store, data, success ) {
                        me.log( [ "release datastore", data ]);
                        var data_length = data.length;
                        for ( var i=0; i<data_length; i++ ) {
                            me.timebox_hash[ data[i].get('ObjectID') ] = { EndDate: data[i].get('ReleaseDate') };
                        }
                        me.log( me.timebox_hash );
                        me._getIterations(type, rows);
                    }
                }
            });
        }
    },
    _getIterations: function(type,rows) {
        var me = this;
        me.log( "_getIterations: " + type );
        var item_length = rows.length;
        
        var query = null;
        for ( var i=0;i<item_length; i++ ) {
            if ( rows[i].iteration ) {
                var single_query = Ext.create('Rally.data.QueryFilter', {
                   property: 'ObjectID',
                   operator: '=',
                   value: rows[i].iteration
                });
                if ( ! query ) {
                    query = single_query;
                } else {
                    query = query.or( single_query );
                }
            }
        }
        if ( query ) {
            Ext.create('Rally.data.WsapiDataStore',{
                autoLoad: true,
                model: 'Iteration',
                fetch: [ 'ObjectID', 'EndDate' ],
                filters: query,
                listeners: {
                    load: function( store, data, success ) {
                        me.log( [ "iteration datastore", data ]);
                        var data_length = data.length;
                        for ( var i=0; i<data_length; i++ ) {
                            me.timebox_hash[ data[i].get('ObjectID') ] = { EndDate: data[i].get('EndDate') };
                        }
                        me.log( me.timebox_hash );
                        me._populateRowData(type,rows);
                    }
                }
            });
        }
    },
    _populateRowData: function( type, rows ) {
        this.log( "_populateRowData: " + type );
        var item_length = rows.length;
        for ( var i=0; i<item_length; i++ ) {
            var item = rows[i];
            if (( item.iteration !== "" ) && ( this.timebox_hash[item.iteration] )) {
                item.iteration_date = this.timebox_hash[item.iteration].EndDate;
            }
            if (( item.release !== "" ) && ( this.timebox_hash[item.release] )) {
                item.release_date = this.timebox_hash[item.release].EndDate;
            }
        }
        this._makeTable( type, rows );
    },
    _makeTable:function( type, rows ) {
        var me = this;
        me.log( "_makeTable: " + type);
        var cols = [
                { id: 'direction', label: 'Your Team...', type: 'string' },
                { id: 'project', label: 'Team', type: 'string' },
                { id: 'name', label: 'Our Story', type: 'string' },
                { id: 'schedule_state', label: 'State', type: 'string' },
                { id: 'release_date', label: 'Release Date', type: 'date' },
                { id: 'iteration_date', label: 'Iteration Date', type: 'date' },
                { id: 'other_project', label: 'Other Project', type: 'string' },
                { id: 'other_name', label: 'Their Story', type: 'string' },
                { id: 'other_schedule_state', label: 'State', type: 'string' },
                { id: 'other_release_date', label: 'Release Date', type: 'date' },
                { id: 'other_iteration_date', label: 'Iteration Date', type: 'date' },
                { id: 'tags', label: 'Tags', type: 'string' }
            ];
        var data_table = new google.visualization.DataTable({
            cols: cols
        });
        // google table is scary because row is pushed as an array of column values
        // that have to be matched to the cols array above (would be nice to have key indexing)
        var number_of_rows = rows.length;
        for ( var i=0; i<number_of_rows; i++ ) {
            var table_row = [];
            Ext.Array.each( cols, function(column) {
                table_row.push( rows[i][column.id] );
            });
            me.log( table_row );
            data_table.addRow(table_row);
        }
        
        var view = new google.visualization.DataView(data_table);
        var outer_box_id = type + '_box';
        
        if ( me.down('#' + outer_box_id ) ) { me.down('#'+outer_box_id).destroy(); }
        me.down('#table_box').add( { xtype: 'container', itemId: outer_box_id, id: outer_box_id } );
        
        var table = new google.visualization.Table( document.getElementById(outer_box_id) );
        table.draw( view, { showRowNumber: false, allowHtml: true } );
    }
});
