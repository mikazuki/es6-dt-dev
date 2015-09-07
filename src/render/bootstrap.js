import {tag,text,remove_children} from './dom';
import {value_renderer} from './shared';

export let bundle = {};
export default bundle;

bundle.table = (parts,api,table,opts) => {
	let dom = tag('div',{class:'dt-wrapper'});
	
	if( parts.controls ) {
		dom.appendChild(parts.controls);
		api.controls.redraw();
	}
	
	let table_dom = tag('table',{class:`table dt-table ${table.classes() || ''}`});
	
	if( parts.header) {
		table_dom.appendChild(parts.header);
		api.header.redraw();
	}
	
	if( parts.body ) {
		table_dom.appendChild(parts.body);
		api.body.redraw();
	}
	
	let table_wrapper = tag('div',{class:'dt-table-wrapper'},table_dom);
	dom.appendChild(table_wrapper);
	
	if( parts.pagination ) {
		dom.appendChild(parts.pagination);
		api.pagination.redraw();
	}
	
	return dom;
};

bundle.controls = (controls,opts) => {
	let ul_classes = 'dropdown-menu';
	let ul = tag('ul',{class:ul_classes});
	let btn = tag('div',{class:'btn-group dt-controls'},
		tag('button',{class:'btn btn-sm btn-default dropdown-toggle',type:'button','data-toggle':'dropdown'},
			tag('span',{class:'glyphicon glyphicon-cog',type:'button'})
		),
		ul
	);
	
	let redraw = (controls,columns,ordered,opts) => {
		remove_children(ul);
		let drag_source = null;
		
		if( !ordered )
			ordered = columns.slice();
		
		let add_drag_target_support = (li,classes,equals,move) => {
			li.addEventListener('drop',e=>{
				if( !drag_source || equals(drag_source) ) return;
				
				li.className = classes;
				e.preventDefault();

				move(drag_source);
			});
			
			li.addEventListener('dragover',e=>{ if( !drag_source || equals(drag_source) ) return; e.preventDefault(); });
			li.addEventListener('dragenter',e=>{ if( !drag_source || equals(drag_source) ) return; e.preventDefault(); li.className = classes + ' dt-drag-target'; });
			li.addEventListener('dragleave',e=>{ li.className = classes; });
		};
		
		ordered.forEach(c=>{
			if( !c.controllable() ) return;
			
			let li,icon;
			let li_classes = `dt-clickable ${c.hidden() ? 'dt-column-hidden' : ''}`;
			ul.appendChild(li=tag('li',{class:li_classes,draggable:true},tag('a',{},
				icon=tag('span',{class:'dt-hidden-icon glyphicon glyphicon-eye-open'}),
				text(' '),
				text(c.label()||'')
			)));
			
			li.addEventListener('click',e=>{
				e.stopPropagation();
				
				c.hidden(!c.hidden());
				
				controls.table.redraw_header();
				controls.table.redraw_controls();
				controls.table.redraw_body();
			});
			
			li.addEventListener('dragstart',e=>{
				ul.className = ul_classes + ' dt-dragging';
				e.dataTransfer.effectAllowed = 'move';
				e.dataTransfer.dropEffect = 'move';
				
				drag_source = c;
			});
			
			li.addEventListener('dragend',e=>{
				ul.className = ul_classes;
				drag_source=null;
			});

			add_drag_target_support(li,li_classes,o=>o===c,source=>{
				ordered.splice(ordered.indexOf(source),1);
				ordered.splice(ordered.indexOf(c),0,source);
				
				controls.table.columns_order(ordered);
				
				controls.table.redraw_header();
				controls.table.redraw_controls();
				controls.table.redraw_body();
			});
		});
		
		// move to end
		{
			let li_classes = 'dt-drag-end-target';
			let li = tag('li',{class:li_classes},tag('a',{},tag('span',{class:'glyphicon glyphicon-arrow-down'})));
			
			add_drag_target_support(li,li_classes,o=>false,source=>{
				ordered.splice(ordered.indexOf(source),1);
				
				for(let i=ordered.length-1;i>=0;--i) {
					if( !ordered[i].controllable() )
						continue;
					
					ordered.splice(i+1,0,source);
					break;
				}
				
				controls.table.columns_order(ordered);
				
				controls.table.redraw_header();
				controls.table.redraw_controls();
				controls.table.redraw_body();
			});
			
			ul.appendChild(li);
		}
	};
	
	controls.redraw.attach(redraw);
	
	return btn;
};

bundle.header = (header,columns,opts) => {
	let table = header.table;
	let thead = tag('thead');
	let tr = tag('tr');

	let redraw = (header,columns,opts) => {
		remove_children(tr);
		
		columns.forEach(column=>{
			column.header_th_renderer()(tr,column,header,opts);
		});
	};
	
	header.redraw.attach(redraw);
	
	thead.appendChild(tr);
	return thead;
};

bundle.header_th = (tr,column,header,opts) => {
	let th = tag('th',{class:(column.classes()||'')});
	
	if( column.align() )
		th.className += ` dt-align-${column.align()}`;

	column.header_label_renderer()(th,column,header,opts);
	
	if( column.sortable() )
		column.sort_renderer()(th,column,header,opts);
	
	if( column.minimize() )
		th.className += ' dt-minimize';

	tr.appendChild(th);
};

bundle.header_label = (th,column,header,opts) => {
	let label = column.label();
	if( label!=null )
		th.appendChild(text(label));
};

bundle.header_sort = (th,column,header,opts) => {
	th.appendChild(text(' '));
	
	let sort_classes = 'dt-sort glyphicon';
	let sort = tag('span',{});
	
	switch(column.sort()) {
	case 'asc': sort.className = sort_classes + ' glyphicon-sort-by-attributes dt-sort-active'; break;
	case 'desc': sort.className = sort_classes + ' glyphicon-sort-by-attributes-alt dt-sort-active'; break;
	default: sort.className = sort_classes + ' glyphicon-sort'; break;
	}
	
	th.className += ' dt-clickable';
	th.addEventListener('click',()=>{
		switch(column.sort()) {
		default: column.sort('asc'); break;
		case 'asc': column.sort('desc'); break;
		case 'desc': column.sort( column.allow_no_sort() ? null : 'asc' ); break;
		}
		
		header.table.column_sort_changed(column);
		header.redraw();
		header.table.fetch();
	});
	
	th.appendChild(sort);
};

bundle.body = (body,columns,opts) => {
	let table = body.table;
	let tbody = tag('tbody');

	let redraw = (body,columns,slice,opts) => {
		remove_children(tbody);

		if( !slice.data || slice.data.length==0 ) {
			let no_rows_renderer = body.no_rows_renderer();
			if( no_rows_renderer )
				no_rows_renderer(tbody,columns,slice,body,opts);
			
			return;
		}

		let row_renderer = body.row_renderer();
		slice.data.forEach((row,i)=>{
			row_renderer(tbody,row,i,columns,slice,body,opts);
		});
	};
	
	body.redraw.attach(redraw);

	return tbody;
};

bundle.no_rows = (tbody,columns,slice,body,opts) => {
	if( columns.length==0 ) return;
	
	tbody.appendChild(tag('tr',{class:'dt-no-rows'},tag('td',{colspan:columns.length},tag('span',{class:'glyphicon glyphicon-grain'}))));
}

bundle.row = (parent,row,i,columns,slice,body,opts) => {
	let table = body.table;
	let tr = tag('tr');
	
	columns.forEach(column=>{
		let value = column.mapper()(row,i,slice,column,body,opts);
		column.td_renderer()(tr,value,row,column,body,opts);
	});
	
	parent.appendChild(tr);
};

bundle.td = (parent,value,row,column,body,opts) => {
	let td = tag('td',{class:(column.classes()||'')});
	
	if( column.align() )
		td.className += ` dt-align-${column.align()}`;
		
	if( column.minimize() )
		td.className += ' dt-minimize';

	column.cell_renderer()(td,value,row,column,body,opts);
	
	parent.appendChild(td);
};

bundle.cell = (parent,value,row,column,body,opts) => {
	let rendered_value = column.value_renderer()(value,row,column,body,opts);
	if( rendered_value!=null ) parent.appendChild(rendered_value);
};

bundle.value = value_renderer;

bundle.pagination = (pagination,opts) => {
	let table = pagination.table;

	let fns = {
		prev: null,
		next: null,
		page: null,
	}
	
	let busy_classes = 'dt-busy glyphicon glyphicon-refresh';

	let prev = tag('button',{class:'btn btn-default btn-sm'},text('«'));
	let next = tag('button',{class:'btn btn-default btn-sm'},text('»'));
	let page = tag('input',{class:'form-control input-sm dt-page-input',type:'text',size:3});
	let busy = tag('span',{class:'td-display-none'});
	let pages = tag('span',{class:'dt-pages'});
	
	prev.addEventListener('click',()=>(fns.prev && fns.prev()));
	next.addEventListener('click',()=>(fns.next && fns.next()));

	page.addEventListener('keypress',e=>{
		if( e.keyCode!=13 ) return;
		e.preventDefault();
		let p = parseInt(page.value);
		if( !isFinite(p) ) p = 0;
		if( fns.page ) fns.page(p-1);
	});
	
	let show = (i,page)=>{
		page = Math.max(0,page);
		if( i.pages!=null ) page = Math.min(page,i.pages);
		else if( !i.has_more ) page = Math.min(page,i.page);
		
		pagination.show(page);
	};

	let redraw = (pagination,info,opts) => {
		let i = info;
		
		page.value = i.page!=undefined ? i.page+1 : null;
		
		if( i.pages===undefined )
			pages.parentNode.className = 'dt-display-none';
		else {
			pages.parentNode.className = 'input-group-addon';
			remove_children(pages);
			pages.appendChild(text(i.pages+1));
		}
			
		if( table.fetcher() ) {
			busy.parentNode.className = 'input-group-addon dt-clickable';
			
			if( pagination.table.fetching() )
				busy.className = busy_classes + ' dt-busy-active';
			else
				busy.className = busy_classes;
		} else
			busy.parentNode.className = 'dt-display-none';
		
		if( i.page===undefined )
			fns.prev = fns.next = fns.page = null;
		
		fns.prev = ()=>show(i,i.page-1);
		fns.next = ()=>show(i,i.page+1);
		fns.page = p=>show(i,p);
	};
	
	pagination.redraw.attach(redraw);
	
	let busy_parent = tag('span',{class:'dt-display-none'},busy);
	busy_parent.addEventListener('click',() => { if( !table.fetching() ) table.fetch(); });

	return tag('div',{class:'dt-pagination-wrapper'},tag('div',{class:'input-group dt-pagination'},
		tag('span',{class:'input-group-btn'},prev),
		page,
		busy_parent,
		tag('span',{class:'input-group-addon'},pages),
		tag('span',{class:'input-group-btn'},next)
	));
};
