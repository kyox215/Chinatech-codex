using System;
using System.Collections.Generic;
using System.IO;
using System.Xml;

// Test-only parser. It never prints the content of an encoded child error stream.
public static class CTDiagnosticStderr {
    public sealed class Result {
        public readonly bool Allowed;public readonly string Root;public readonly int Records;public readonly string[] Streams;
        public Result(bool allowed,string root,int records,string[] streams){Allowed=allowed;Root=root;Records=records;Streams=streams;}
    }
    private static string SafeStream(string stream) {
        string value=(stream??"").ToLowerInvariant();
        foreach(string known in new string[]{"progress","error","warning","verbose","debug","information","output"})if(value==known)return known;
        return "unknown";
    }
    public static Result Inspect(string text) {
        if(String.IsNullOrWhiteSpace(text))return new Result(true,"none",0,new string[0]);
        string value=text.TrimStart();const string marker="#< CLIXML";
        if(value.Length>65536||!value.StartsWith(marker,StringComparison.Ordinal))return new Result(false,"non-clixml",0,new string[]{"unknown"});
        int offset=marker.Length;
        if(value.Length>offset&&value[offset]=='\r')offset++;
        if(value.Length<=offset||value[offset]!='\n')return new Result(false,"invalid-header",0,new string[]{"unknown"});
        var streams=new SortedSet<string>(StringComparer.Ordinal);int count=0;
        try {
            var settings=new XmlReaderSettings{DtdProcessing=DtdProcessing.Prohibit,XmlResolver=null,MaxCharactersInDocument=65536};
            var document=new XmlDocument{XmlResolver=null,PreserveWhitespace=false};
            using(var source=new StringReader(value.Substring(offset+1)))using(var reader=XmlReader.Create(source,settings)){document.Load(reader);}
            var root=document.DocumentElement;
            if(root==null||root.LocalName!="Objs"||root.NamespaceURI!="http://schemas.microsoft.com/powershell/2004/04"||root.GetAttribute("Version")!="1.1.0.1")
                return new Result(false,"unexpected",0,new string[]{"unknown"});
            bool allowed=true;
            foreach(XmlNode node in root.ChildNodes) {
                if(node.NodeType==XmlNodeType.Whitespace)continue;
                var element=node as XmlElement;
                if(element==null){allowed=false;streams.Add("unknown");continue;}
                count++;string stream=element.GetAttribute("S");streams.Add(SafeStream(stream));
                // Only real object records explicitly in the progress stream are benign.
                if(element.LocalName!="Obj"||element.NamespaceURI!=root.NamespaceURI||stream!="progress")allowed=false;
            }
            foreach(XmlNode node in document.SelectNodes("//*[@S]")) {
                var element=(XmlElement)node;string stream=element.GetAttribute("S");streams.Add(SafeStream(stream));
                if(stream!="progress")allowed=false;
            }
            var names=new string[streams.Count];streams.CopyTo(names);return new Result(allowed,"Objs",count,names);
        }catch{return new Result(false,"parse-error",count,new string[]{"unknown"});}
    }
}
