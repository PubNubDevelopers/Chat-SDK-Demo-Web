import Avatar from './avatar'
import Image from 'next/image'
import { roboto } from '@/app/fonts'
import { useState, useEffect, useCallback } from 'react'
import MessageActions from './messageActions'
import PinnedMessagePill from './pinnedMessagePill'
import QuotedMessage from './quotedMessage'
import MessageReaction from './messageReaction'
import { MessageActionsTypes, PresenceIcon, ToastType } from '@/app/types'
import ToolTip from './toolTip'
import { Channel, TimetokenUtils, MixedTextTypedElement } from '@pubnub/chat'

export default function Message ({
  received,
  inThread = false,
  inPinned = false,
  avatarUrl,
  readReceipts,
  showReadIndicator = true,
  quotedMessageSender = '',
  sender,
  messageActionHandler = (a, b) => {},
  pinned = false,
  unpinMessageHandler = () => {},
  message,
  currentUserId,
  isOnline = -1,
  showUserMessage = (a, b, c, d) => {},
  openAIModeration
}) {
  const [showToolTip, setShowToolTip] = useState(false)
  const [actionsShown, setActionsShown] = useState(false)
  let messageHovered = false
  let actionsHovered = false
  const [showHarmfulMessage, setShowHarmfulMessage] = useState(false)

  const handleMessageMouseEnter = e => {
    messageHovered = true
    setActionsShown(true)
  }
  const handleMessageMouseLeave = e => {
    messageHovered = false
    setActionsShown(false)
  }

  function testIfActionsHovered () {
    if (messageHovered) return
    if (!actionsHovered) {
      setActionsShown(false)
    }
  }

  function handleMessageActionsEnter () {
    actionsHovered = true
    setActionsShown(true)
  }

  function handleMessageActionsLeave () {
    actionsHovered = false
    if (!messageHovered) {
      setActionsShown(false)
    }
  }

  function copyMessageText (messageText) {
    navigator.clipboard.writeText(messageText)
  }

  function openLink (url) {
    window.open(url, '_blank')
  }

  function userClick (userId, userName) {
    showUserMessage(
      '@Mentioned User Clicked:',
      `You have Clicked on user with ID ${userId} and name ${userName}`,
      'https://www.pubnub.com/docs/chat/chat-sdk/build/features/users/mentions',
      ToastType.INFO
    )
  }

  function channelClick (channelId, channelName) {
    showUserMessage(
      '#Referenced Channel Clicked:',
      `You have Clicked on channel with ID ${channelId} and name ${channelName}`,
      'https://www.pubnub.com/docs/chat/chat-sdk/build/features/channels/references',
      ToastType.INFO
    )
  }

  async function reactionClicked (emoji, timetoken) {
    await message?.toggleReaction(emoji)
  }

  const determineUserReadableDate = useCallback(timetoken => {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ]
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const date = TimetokenUtils.timetokenToDate(timetoken)
    const datetime = `${days[date.getDay()]} ${date.getDate()} ${
      months[date.getMonth()]
    } ${(date.getHours() + '').padStart(2, '0')}:${(
      date.getMinutes() + ''
    ).padStart(2, '0')}`

    return datetime
  }, [])

  //  Originally I was not writing the 'lastTimetoken' for messages I was sending myself, however
  //  that caused the Chat SDK's notion of an unread message count inconsistent, so I am removing
  //  readReceipts I set myself in this useCallback
  const determineReadStatus = useCallback((timetoken, readReceipts) => {
    if (!readReceipts) return false
    let returnVal = false
    for (var i = 0; i < Object.keys(readReceipts).length; i++) {
      const receipt = Object.keys(readReceipts)[i]
      const findMe = readReceipts[receipt].indexOf(currentUserId)
      if (findMe > -1) {
        readReceipts[receipt].splice(findMe, 1)
      }
      if (readReceipts[receipt].length > 0 && receipt >= timetoken) {
        return true
      }
    }
    return false
  }, [])

  const renderMessagePart = useCallback(
    (messagePart: MixedTextTypedElement, index: number) => {
      if (messagePart?.type === 'text') {
        return <span key={index}>{messagePart.content.text}</span>
      }
      if (messagePart?.type === 'plainLink') {
        return (
          <span
            key={index}
            className='cursor-pointer underline'
            onClick={() => openLink(`${messagePart.content.link}`)}
          >
            {messagePart.content.link}
          </span>
        )
      }
      if (messagePart?.type === 'textLink') {
        return (
          <span
            key={index}
            className='cursor-pointer underline'
            onClick={() => openLink(`${messagePart.content.link}`)}
          >
            {messagePart.content.link}
          </span>
        )
      }
      if (messagePart?.type === 'mention') {
        return (
          <span
            key={index}
            onClick={() =>
              userClick(
                `${messagePart.content.id}`,
                `${messagePart.content.name}`
              )
            }
            className='rounded-lg border px-2 py-0.5 line-clamp-1 text-nowrap select-none cursor-pointer border-neutral-300 bg-neutral-50 text-neutral-900 m-1'
          >
            @{messagePart.content.name}
          </span>
        )
      }

      if (messagePart?.type === 'channelReference') {
        return (
          <span
            key={index}
            onClick={() =>
              channelClick(
                `${messagePart.content.id}`,
                `${messagePart.content.name}`
              )
            }
            className='rounded-lg border px-2 py-0.5 line-clamp-1 text-nowrap select-none cursor-pointer border-neutral-300 bg-neutral-50 text-neutral-900 m-1'
          >
            #{messagePart.content.name}
          </span>
        )
      }
      return 'error'
    },
    []
  )

  return (
    <div className='flex flex-col w-full'>
      <div
        className={`flex flex-row ${inThread ? '' : 'w-5/6'} my-4 ${
          inThread ? 'mx-6' : 'mx-8'
        } ${!received && !inThread && 'self-end'}`}
      >
        {received && !inThread && !inPinned && (
          <div className='min-w-11'>
            {!inThread && (
              <Avatar
                present={isOnline}
                avatarUrl={avatarUrl ? avatarUrl : '/avatars/placeholder.png'}
              />
            )}
          </div>
        )}

        <div className='flex flex-col w-full gap-2'>
          <div
            className={`flex flex-row ${
              inThread || inPinned || received
                ? 'justify-between'
                : 'justify-end'
            }`}
          >
            {pinned && !received && (
              <div className='flex justify-start grow select-none'>
                <PinnedMessagePill />
              </div>
            )}
            {(inThread || inPinned || received) && (
              <div
                className={`${roboto.className} text-sm font-normal flex text-neutral-600`}
              >
                {sender}
                {(inThread || inPinned) && !received && ' (you)'}
                {pinned && <PinnedMessagePill />}
              </div>
            )}
            <div
              className={`${roboto.className} text-sm font-normal flex text-neutral-600`}
            >
              {determineUserReadableDate(message.timetoken)}
            </div>
          </div>

          <div
            className={`${
              roboto.className
            } relative text-base font-normal flex text-black ${
              received ? 'bg-neutral-50' : 'bg-[#e3f1fd]'
            } p-4 rounded-b-lg ${
              received ? 'rounded-tr-lg' : 'rounded-tl-lg'
            } pb-[${!received ? '40px' : '0px'}]`}
            onMouseEnter={handleMessageMouseEnter}
            onMouseMove={handleMessageMouseEnter}
            onMouseLeave={handleMessageMouseLeave}
          >
            {inPinned && (
              <div
                className='cursor-pointer'
                onClick={() => unpinMessageHandler()}
                onMouseEnter={() => {
                  setShowToolTip(true)
                }}
                onMouseLeave={() => {
                  setShowToolTip(false)
                }}
              >
                <div className='absolute right-[10px] top-[10px]'>
                  <div className='relative'>
                    <ToolTip
                      className={`${
                        showToolTip ? 'block' : 'hidden'
                      } bottom-[0px]`}
                      tip='Unpin'
                      messageActionsTip={false}
                    />
                  </div>
                  <Image
                    src='/icons/close.svg'
                    alt='Close'
                    className=''
                    width={20}
                    height={20}
                    priority
                  />
                </div>
              </div>
            )}
            <div className='flex flex-col w-full'>
              {message.quotedMessage && (
                <QuotedMessage
                  originalMessage={message}
                  originalMessageReceived={received}
                  quotedMessage={message.quotedMessage}
                  quotedMessageSender={quotedMessageSender}
                  setQuotedMessage={null}
                  displayedWithMesageInput={false}
                />
              )}
              {/* Will chase with the chat team to see why I need these conditions (get an error about missing 'type' if they are absent) */}
              <div className='flex flex-row items-center w-full flex-wrap'>
                {(!message.content.openAiModeration || !message.content.openAiModeration?.results[0].flagged || showHarmfulMessage) && ((message.content.text ||
                  message.content.plainLink ||
                  message.content.textLink ||
                  message.content.mention ||
                  message.content.channelReference) &&
                  message
                    .getMessageElements()
                    .map((msgPart, index) => renderMessagePart(msgPart, index)))}
                {message.actions && message.actions.edited && <span className="text-navy500">&nbsp;&nbsp;(edited)</span>}
                {!showHarmfulMessage && message.content.openAiModeration?.results[0].flagged && <span>Message contains potentially harmful content <span className="text-blue-400 cursor-pointer" onClick={() => {setShowHarmfulMessage(true)}}>(Reveal)</span></span>}
              </div>
            </div>
            {!received && showReadIndicator && (
              <Image
                src={`${
                  determineReadStatus(message.timetoken, readReceipts)
                    ? '/icons/read.svg'
                    : '/icons/sent.svg'
                }`}
                alt='Read'
                className='absolute right-[10px] bottom-[14px]'
                width={21}
                height={10}
                priority
              />
            )}
            <div className='absolute right-[10px] -bottom-[20px] flex flex-row items-center z-10 select-none'>
              {/*arrayOfEmojiReactions*/}
              {message.reactions
                ? Object?.keys(message.reactions)
                    .slice(0, 18)
                    .map((emoji, index) => (
                      <MessageReaction
                        emoji={emoji}
                        messageTimetoken={message.timetoken}
                        count={message.reactions[emoji].length}
                        reactionClicked={reactionClicked}
                        key={index}
                      />
                    ))
                : ''}
            </div>
            {!inThread && message.hasThread && <div className='absolute right-[10px] -bottom-[28px] flex flex-row items-center z-0 cursor-pointer select-none' onClick={() => {messageActionHandler(
                  MessageActionsTypes.REPLY_IN_THREAD,
                  message
                )}}>
              {/*Whether or not there is a threaded reply*/}
              <div className='flex flex-row cursor-pointer' >
              <Image
                    src='/icons/reveal-thread.svg'
                    alt='Expand'
                    className=''
                    width={20}
                    height={20}
                    priority
                  />
              <div className='text-sm font-normal text-navy700'>
              Replies
              </div>
              </div>
            </div>}
            {/* actions go here for received */}
            {received && !inThread && !inPinned && (
              <MessageActions
                received={received}
                actionsShown={actionsShown}
                timetoken={message.timetoken}
                isPinned={pinned}
                messageActionsEnter={() => handleMessageActionsEnter()}
                messageActionsLeave={() => handleMessageActionsLeave()}
                replyInThreadClick={() =>
                  messageActionHandler(
                    MessageActionsTypes.REPLY_IN_THREAD,
                    message
                  )
                }
                quoteMessageClick={() =>
                  messageActionHandler(MessageActionsTypes.QUOTE, message)
                }
                pinMessageClick={() => {
                  messageActionHandler(MessageActionsTypes.PIN, message)
                }}
                showEmojiPickerClick={data => {
                  messageActionHandler(MessageActionsTypes.SHOW_EMOJI, data)
                }}
                copyMessageClick={() => {
                  copyMessageText(message.content.text)
                  messageActionHandler(MessageActionsTypes.COPY, {
                    text: message.content.text
                  })
                }}
              />
            )}
          </div>
          {/* actions go here for sent */}
          {!received && !inThread && !inPinned && (
            <MessageActions
              received={received}
              actionsShown={actionsShown}
              timetoken={message.timetoken}
              isPinned={pinned}
              messageActionsEnter={() => handleMessageActionsEnter()}
              messageActionsLeave={() => handleMessageActionsLeave()}
              replyInThreadClick={() =>
                messageActionHandler(
                  MessageActionsTypes.REPLY_IN_THREAD,
                  message
                )
              }
              quoteMessageClick={() =>
                messageActionHandler(MessageActionsTypes.QUOTE, message)
              }
              pinMessageClick={() => {
                messageActionHandler(MessageActionsTypes.PIN, message)
              }}
              showEmojiPickerClick={data => {
                messageActionHandler(MessageActionsTypes.SHOW_EMOJI, data)
              }}
              copyMessageClick={() => {
                copyMessageText(message.content.text)
                messageActionHandler(MessageActionsTypes.COPY, {
                  text: message.content.text
                })
              }}
            />
          )}
        </div>
      </div>
      {inPinned && (
        <div className='flex flex-row place-self-center mt-2 border border-navy200 w-5/6'></div>
      )}
    </div>
  )
}
