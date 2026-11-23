"""Bundle this project's static named/namespace ES modules for offline file opening.
No network, dependencies, evaluation of source, minification, or asset changes.
"""
from pathlib import Path
import re, json, sys

root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
factories={}
def bundle(path):
    path=path.resolve();name=path.relative_to(root).as_posix()
    if name in factories:return name
    factories[name]=None
    source=path.read_text(encoding='utf-8');exports={}
    def imported(match):
        bindings,url=match.groups();dependency=(path.parent/url).resolve()
        dependency.relative_to(root)
        dep=bundle(dependency);bindings=bindings.strip()
        if bindings.startswith('* as '):return 'const '+bindings[5:].strip()+'=__load('+json.dumps(dep)+');'
        assert bindings.startswith('{') and bindings.endswith('}'),bindings
        items=[]
        for part in bindings[1:-1].split(','):
            names=part.strip().split(' as ')
            if names[0]:items.append(names[0]+(':'+names[1] if len(names)>1 else ''))
        return 'const {'+','.join(items)+'}=__load('+json.dumps(dep)+');'
    source=re.sub(r'^import\s+([\s\S]*?)\s+from\s+[\'"]([^\'"]+)[\'"];',imported,source,flags=re.M)
    def export_list(match):
        for part in match.group(1).split(','):
            names=part.strip().split(' as ')
            if names[0]:exports[names[-1].strip()]=names[0].strip()
        return ''
    source=re.sub(r'^export\s*\{([^}]+)\}\s*;',export_list,source,flags=re.M)
    def declaration(match):
        kind,name=match.groups();exports[name]=name;return kind+' '+name
    source=re.sub(r'^export\s+(class|function|const|let|var)\s+(\w+)',declaration,source,flags=re.M)
    assert not re.search(r'^\s*(?:import\s|export\s)',source,re.M),'Unsupported module syntax in '+name
    getters=','.join(json.dumps(k)+':{enumerable:true,get:()=>'+v+'}' for k,v in exports.items())
    factories[name]='function(__exports){\n'+source+'\nObject.defineProperties(__exports,{'+getters+'});\n}'
    return name
entry=bundle(root/'js/scenes.js')
assert all(factories.values())
out="/* IRONMARCH offline build. Original sources and Three.js license are included. */\n(()=>{'use strict';const __factories=Object.create(null),__cache=Object.create(null);\n"
for name,code in factories.items():out+='__factories['+json.dumps(name)+']='+code+';\n'
out+="function __load(name){if(__cache[name])return __cache[name];const value={};__cache[name]=value;__factories[name](value);return value;}\n__load("+json.dumps(entry)+");})();\n"
(root/'ironmarch.bundle.js').write_text(out,encoding='utf-8')
print('Bundled',len(factories),'local modules:',len(out.encode('utf-8')),'bytes')
