import { Suspense } from "react";
import { ChatScreen } from "@/components/chat/ChatScreen";

export default function ChatPage({ params }: PageProps<"/c/[id]">) {
  // Chat ids are only known at request time, so read them inside Suspense.
  return <Suspense fallback={null}>{params.then(({ id }) => <ChatScreen key={id} id={id} />)}</Suspense>;
}
