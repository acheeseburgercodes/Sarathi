import { SarathiApp } from "@/components/sarathi-app";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <SarathiApp view="sitrep-detail" detail={id}/>}
