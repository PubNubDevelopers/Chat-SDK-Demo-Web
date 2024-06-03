import Avatar from './avatar'
import Image from 'next/image'
import { roboto } from '@/app/fonts'
import { useState, useEffect, useCallback } from 'react'
import MessageActions from './messageActions'
import PinnedMessagePill from './pinnedMessagePill'
import QuotedMessage from './quotedMessage'
import MessageReaction from './messageReaction'
import { MessageActionsTypes, PresenceIcon } from '@/app/types'
import ToolTip from './toolTip'
import { Channel, TimetokenUtils, MixedTextTypedElement } from '@pubnub/chat'

export default function Message ({
  received,
  //reactions,
  inThread = false,
  inPinned = false,
  avatarUrl,
  //isRead,
  readReceipts,
  showReadIndicator = true,
  //containsQuote = false,
  //quotedMessage = null,
  quotedMessageSender = '',
  sender,
  //messageText,
  messageActionHandler = (a, b) => {},
  pinned = false,
  unpinMessageHandler = () => {
    console.log('ToDo: Unpin Message')
  },
  message,
  currentUserId,
  isOnline = -1
  //setMessages
  //activeChannel
  //reactions = ['']
}) {
  const [showToolTip, setShowToolTip] = useState(false)
  const [actionsShown, setActionsShown] = useState(false)
  //const [userReadableDate, setUserReadableDate] = useState('')
  let messageHovered = false
  let actionsHovered = false

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
    //console.log('parent - message actions leave')
    actionsHovered = false
    if (!messageHovered) {
      setActionsShown(false)
      //console.log('setting actions shown false from message actions mouse leave.  messageHovered is ' + messageHovered)
    }
  }

  function copyMessageText (messageText) {
    navigator.clipboard.writeText(messageText)
  }

  async function reactionClicked (emoji, timetoken) {
    //const message = messages.find(message => message.timetoken === timetoken)
    //    const message = await activeChannel?.getMessage(timetoken)
    await message?.toggleReaction(emoji)
    //setMessages(messages => [...messages])
    console.log('click')
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

    //setUserReadableDate(datetime)
    return datetime
    //setUserReadableDate(`${days[dateTime.getDay()]} ${dateTime.getDate()} ${months[dateTime.getMonth()]} ${(dateTime.getHours() + "").padStart(2, '0')}:${(dateTime.getMinutes() + "").padStart(2, '0')}`)
  }, [])

  //  Originally I was not writing the 'lastTimetoken' for messages I was sending myself, however
  //  that caused the Chat SDK's notion of an unread message count inconsistent, so I am removing
  //  readReceipts I set myself in this useCallback
  const determineReadStatus = useCallback((timetoken, readReceipts) => {
    if (!readReceipts) return ''
    let returnVal = false
    for (var i = 0; i < Object.keys(readReceipts).length; i++) {
      const receipt = Object.keys(readReceipts)[i]
      const findMe = readReceipts[receipt].indexOf(currentUserId)
      if (findMe > -1) {
        readReceipts[receipt].splice(findMe, 1)
      }
      if (readReceipts[receipt].length > 0) {
        return receipt >= timetoken
      }
    }
    return false
  }, [])

  
  /*
  const renderMessagePart = (messagePart: MixedTextTypedElement) => {
    return "";
    if (messagePart?.type === "textLink") {
      return (
        ""
        //<a href={messagePart.content.link} style={{ backgroundColor: 'red' }}>
          //{messagePart.content.text}
        //</a>
      );
    }
    return "";
  }
  */

  const renderMessagePart = useCallback(
    (
      messagePart: MixedTextTypedElement,
      index: number,
      userId: string | number
    ) => {
      // TODO make it look nice
      //  ToDo: Does this useCallback still require the UserId
      if (messagePart?.type === 'text') {
        return messagePart.content.text + ""
      }
      if (messagePart?.type === 'plainLink') {
        return {
          /*<Text
            key={index}
            variant="body"
            onPress={() => openLink(messagePart.content.link)}
            color="sky150"
          >
            {messagePart.content.link}
        </Text>*/
        }
      }
      if (messagePart?.type === 'textLink') {
        return {
          /*<Text
            key={index}
            variant="body"
            onPress={() => openLink(messagePart.content.link)}
            color="sky150"
          >
            {messagePart.content.text}
        </Text>*/
        }
      }
      if (messagePart?.type === 'mention') {
        return {
          /*<Text
            key={index}
            variant="body"
            onPress={() => openLink(`https://pubnub.com/${messagePart.content.id}`)}
            color="sky150"
          >
            @{messagePart.content.name}
        </Text>*/
        }
      }
      if (messagePart?.type === 'channelReference') {
        return {
          /*<Text
            key={index}
            variant="body"
            onPress={() => openChannel(messagePart.content.id)}
            color="sky150"
          >
            #{messagePart.content.name}
        </Text>*/
        }
      }

      return ""
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
              {/*message.content.text*/}
              {/*todo "hack" because I accidentally posted some messages with no content*/}
              {message.content.text && message.getMessageElements().map((msgPart, index) => (
                  //"blah"
                  //<div key={index}>index</div>)
                  renderMessagePart(msgPart, index, message.userId)
                ))}
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
            <div className='absolute right-[10px] -bottom-[18px] flex flex-row items-center select-none'>
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
