import { SarathiApp } from "@/components/sarathi-app";
export default async function Page({params}:{params:Promise<{agent:string}>}){const {agent}=await params;return <SarathiApp view="agent" detail={agent}/>}
