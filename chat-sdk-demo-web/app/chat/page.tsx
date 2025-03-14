'use client'

import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useContext, useCallback, useRef } from 'react'
import { loadEnvConfig } from '@next/env'
import {
  Channel,
  Chat,
  Membership,
  User,
  ThreadChannel,
  Message as pnMessage
} from '@pubnub/chat'
import Image from 'next/image'
import { roboto } from '@/app/fonts'
import Header from './ui-components/header'
import ChatSelectionMenu from './ui-components/chatSelectionMenu'
import Avatar from './ui-components/avatar'
import UnreadIndicator from './ui-components/unreadIndicator'
import Message from './ui-components/message'
import MessageList from './ui-components/messageList'
import MessageListThread from './ui-components/messageListThread'
import MessageInput from './ui-components/messageInput'
import NewMessageGroup from './ui-components/newMessageGroup'
import UserMessage from './ui-components/userMessage'
import RoomSelector from './ui-components/roomSelector'
import ProfileScreen from './ui-components/profileScreen'
import TypingIndicator from './ui-components/typingIndicator'
import ChatSettingsScreen from './ui-components/chatSettingsScreen'
import ModalChangeName from './ui-components/modalChangeName'
import ModalManageMembers from './ui-components/modalManageMembers'
import searchImg from '@/public/icons/search.svg'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { testData } from './data/user-data'
import {
  ChatNameModals,
  MessageActionsTypes,
  ChatHeaderActionIcon,
  ToastType,
  ChatEventTypes,
  UnreadMessagesOnChannel,
  PresenceIcon
} from '@/app/types'
import { getAuthKey } from "@/app/getAuthKey"
import { actionCompleted } from 'pubnub-demo-integration'

export default function Page () {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [userId, setUserId] = useState<String | null>('')
  const [chat, setChat] = useState<Chat | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [guidedDemo, setGuidedDemo] = useState<String | null>(null)
  const [loadMessage, setLoadMessage] = useState('Demo is initializing...')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showEmojiMessageTimetoken, setShowEmojiMessageTimetoken] = useState('')
  const [emojiPickerTargetsInput, setEmojiPickerTargetsInput] = useState(false)
  const [selectedEmoji, setSelectedEmoji] = useState('')

  const [showThread, setShowThread] = useState(false)
  const [roomSelectorVisible, setRoomSelectorVisible] = useState(false)
  const [profileScreenVisible, setProfileScreenVisible] = useState(false)
  const [chatSettingsScreenVisible, setChatSettingsScreenVisible] =
    useState(false)
  const [chatSelectionMenuMinimized, setChatSelectionMenuMinimized] =
    useState(false)
  const [creatingNewMessage, setCreatingNewMessage] = useState(false)
  const [changeUserNameModalVisible, setChangeUserNameModalVisible] =
    useState(false)
  const [changeChatNameModalVisible, setChangeChatNameModalVisible] =
    useState(false)
  const [manageMembersModalVisible, setManageMembersModalVisible] =
    useState(false)

  const [name, setName] = useState('')
  const [profileUrl, setProfileUrl] = useState('')
  const [typingData, setTypingData] = useState<string[]>([])

  const [userMsg, setUserMsg] = useState({
    message: 'Message Text.  Message Text.  ',
    title: 'Please Note:',
    href: 'http://www.pubnub.com',
    type: 0
  })
  const [userMsgShown, setUserMsgShown] = useState(false)
  const [userMsgTimeoutId, setUserMsgTimeoutId] = useState(0)
  const [refreshMembersTimeoutId, setRefreshMembersTimeoutId] =
    useState<ReturnType<typeof setTimeout>>()
  const [initOnce, setInitOnce] = useState(0)

  const [quotedMessage, setQuotedMessage] = useState<pnMessage | null>(null)
  const [quotedMessageSender, setQuotedMessageSender] = useState('')
  const [typingUsers, setTypingUsers] = useState<String | null>(null)

  //  State of the channels I'm a member of (left hand pane)
  const [publicChannels, setPublicChannels] = useState<Channel[]>()
  const [privateGroups, setPrivateGroups] = useState<Channel[]>()
  const [directChats, setDirectChats] = useState<Channel[]>()
  const [publicChannelsMemberships, setPublicChannelsMemberships] =
    useState<Membership[]>()
  const [privateGroupsMemberships, setPrivateGroupsMemberships] =
    useState<Membership[]>()
  const [directChatsMemberships, setDirectChatsMemberships] =
    useState<Membership[]>()
  const [publicChannelsUsers, setPublicChannelsUsers] = useState<User[][]>([])
  const [privateGroupsUsers, setPrivateGroupsUsers] = useState<User[][]>([])
  const [directChatsUsers, setDirectChatsUsers] = useState<User[][]>([])
  const [unreadMessages, setUnreadMessages] = useState<
    UnreadMessagesOnChannel[]
  >([])

  //  State of the currently active Channel
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [activeChannelPinnedMessage, setActiveChannelPinnedMessage] =
    useState<pnMessage | null>(null)
  const [activeThreadChannel, setActiveThreadChannel] =
    useState<ThreadChannel | null>(null)
  const [activeThreadMessage, setActiveThreadMessage] =
    useState<pnMessage | null>(null)

  async function emojiSelected (data) {
    if (emojiPickerTargetsInput) {
      setSelectedEmoji(data.native)
    } else {
      //  Selected emoji is intended for a message reaction
      const message = await activeChannel?.getMessage(showEmojiMessageTimetoken)
      message?.toggleReaction(data.native)
      actionCompleted({
        action: 'React to a message (Emoji)',
        blockDuplicateCalls: false,
        debug: false
      })
    }
    setShowEmojiPicker(false)
  }

  /* Bootstrap the application if it is run in an empty keyset */
  async function keysetInit (chat) {
    if (!chat) return
    try {
      await chat?.createPublicConversation({
        channelId: 'public-general',
        channelData: {
          name: 'General Chat',
          description: 'Public group for general conversation',
          custom: {
            profileUrl: '/group/globe1.svg'
          }
        }
      })
    } catch (e) {}

    try {
      await chat?.createPublicConversation({
        channelId: 'public-work',
        channelData: {
          name: 'Work Chat',
          description: 'Public group for conversation about work',
          custom: {
            profileUrl: '/group/globe2.svg'
          }
        }
      })
    } catch (e) {}
  }

  /*  Initialize or Update all the state arrays related to public groups */
  async function updateChannelMembershipsForPublic (chat) {
    if (!chat) return
    //  During development there was an issue filtering on getMemberships on the server, which has since been fixed, so this code could be made more efficient
    chat.currentUser
      .getMemberships({ filter: "channel.type == 'public'" })
      .then(async membershipResponse => {
        const currentMemberOfThesePublicChannels =
          membershipResponse.memberships.map(m => m.channel)

        setPublicChannels(currentMemberOfThesePublicChannels)
        const publicChannelMemberships = membershipResponse.memberships
        setPublicChannelsMemberships(publicChannelMemberships)

        //  Get the users for every public group I am a member of
        let tempPublicUsers: User[][] = []
        for (
          var indexGroup = 0;
          indexGroup < currentMemberOfThesePublicChannels.length;
          indexGroup++
        ) {
          var tempIndex = indexGroup
          const response = await currentMemberOfThesePublicChannels[
            indexGroup
          ].getMembers({ sort: { updated: 'desc' }, limit: 40 })
          if (response.members) {
            //  response contains the most recent 40 members
            const channelUsers = response.members.map((membership, index) => {
              return membership.user
            })
            tempPublicUsers[tempIndex] = channelUsers
          }
        }
        setPublicChannelsUsers(tempPublicUsers)
      })
  }

  /* Initialize or Update all the state arrays related to private groups */
  async function updateChannelMembershipsForGroups (
    chat,
    desiredChannelId = ''
  ) {
    if (!chat) return
    chat.currentUser
      .getMemberships({
        filter: "channel.type == 'group'",
        sort: { updated: 'desc' }
      })
      .then(async membershipResponse => {
        const currentMemberOfTheseGroupChannels =
          membershipResponse.memberships.map(m => m.channel)
        //  Look for the desired channel ID
        for (var i = 0; i < currentMemberOfTheseGroupChannels.length; i++) {
          if (currentMemberOfTheseGroupChannels[i].id === desiredChannelId) {
            //  We have found the channel we want to focus
            setActiveChannel(currentMemberOfTheseGroupChannels[i])
          }
        }

        setPrivateGroups(currentMemberOfTheseGroupChannels)
        const groupChannelMemberships = membershipResponse.memberships
        setPrivateGroupsMemberships(groupChannelMemberships)

        //  Get the users for every private group I am a member of
        let tempGroupUsers: User[][] = []
        for (
          var indexGroup = 0;
          indexGroup < currentMemberOfTheseGroupChannels.length;
          indexGroup++
        ) {
          //currentMemberOfTheseGroupChannels.forEach((channel, index) => {
          var tempIndex = indexGroup
          const response = await currentMemberOfTheseGroupChannels[
            indexGroup
          ].getMembers({ sort: { updated: 'desc' }, limit: 100 })
          if (response.members) {
            const channelUsers = response.members.map((membership, index) => {
              return membership.user
            })
            tempGroupUsers[tempIndex] = channelUsers
          }
        }
        setPrivateGroupsUsers(tempGroupUsers)
      })
  }

  /* Initialize or Update all the state arrays related to Direct message pairs */
  async function updateChannelMembershipsForDirects (
    chat,
    desiredChannelId = ''
  ) {
    if (!chat) return
    chat.currentUser
      .getMemberships({
        filter: "channel.type == 'direct'",
        sort: { updated: 'desc' }
      })
      .then(async membershipResponse => {
        const currentMemberOfTheseDirectChannels =
          membershipResponse.memberships.map(m => m.channel)
        //  Look for the desired channel ID
        for (var i = 0; i < currentMemberOfTheseDirectChannels.length; i++) {
          if (currentMemberOfTheseDirectChannels[i].id === desiredChannelId) {
            //  We have found the channel we want to focus
            setActiveChannel(currentMemberOfTheseDirectChannels[i])
          }
        }
        setDirectChats(currentMemberOfTheseDirectChannels)
        const directChannelMemberships = membershipResponse.memberships
        setDirectChatsMemberships(directChannelMemberships)

        //  Get the users for every direct message pair I am a member of
        let tempDirectUsers: User[][] = []
        for (
          var indexDirects = 0;
          indexDirects < currentMemberOfTheseDirectChannels.length;
          indexDirects++
        ) {
          var tempIndex = indexDirects
          const response = await currentMemberOfTheseDirectChannels[
            indexDirects
          ].getMembers({ sort: { updated: 'desc' }, limit: 100 })

          if (response.members) {
            //  response contains the most recent 100 members
            const channelUsers = response.members.map((membership, index) => {
              return membership.user
            })
            tempDirectUsers[tempIndex] = channelUsers
          }
        }
        setDirectChatsUsers(tempDirectUsers)
      })
  }

  function updateUnreadMessagesCounts () {
    chat?.getUnreadMessagesCounts({}).then(result => {
      let unreadMessagesOnChannel: UnreadMessagesOnChannel[] = []
      result.forEach((element, index) => {
        let newUnreadMessage: UnreadMessagesOnChannel = {
          channel: element.channel,
          count: element.count
        }
        unreadMessagesOnChannel.push(newUnreadMessage)
      })
      setUnreadMessages(unreadMessagesOnChannel)
    })
  }

  /* Initialization logic */
  useEffect(() => {
    async function init () {
      setUserId(searchParams.get('userId'))
      if (userId == null || userId === '') {
        setLoadMessage('Retrieving User ID')
        return
      }
      if (!process.env.NEXT_PUBLIC_PUBNUB_PUBLISH_KEY) {
        setLoadMessage('No Publish Key Found')
        return
      }
      if (!process.env.NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY) {
        setLoadMessage('No Subscribe Key Found')
        return
      }
      //  NEXT_PUBLIC_GUIDED_DEMO can be ignored and omitted from your .env file
      setGuidedDemo(
        process.env.NEXT_PUBLIC_GUIDED_DEMO
          ? process.env.NEXT_PUBLIC_GUIDED_DEMO
          : null
      )
      const { accessManagerToken } = await getAuthKey(userId)
      const localChat = await Chat.init({
        publishKey: process.env.NEXT_PUBLIC_PUBNUB_PUBLISH_KEY,
        subscribeKey: process.env.NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY,
        userId: userId,
        typingTimeout: 5000,
        storeUserActivityTimestamps: true,
        storeUserActivityInterval: 300000, /* 5 minutes */
        authKey: accessManagerToken,
      })
      setChat(localChat)
      setCurrentUser(localChat.currentUser)
      
      if (!localChat.currentUser.profileUrl) {
        const randomProfileUrl = Math.floor(
          Math.random() * testData.avatars.length
        )
        await localChat.currentUser.update({
          name: '' + userId,
          profileUrl: testData.avatars[randomProfileUrl]
        })
        setName('' + userId)
        setProfileUrl(testData.avatars[randomProfileUrl])
      } else {
        if (localChat.currentUser.name) {setName(localChat.currentUser.name)}
        setProfileUrl(localChat.currentUser.profileUrl)
      }

      await localChat
        .getChannels({ filter: `type == 'public'` })
        .then(async channelsResponse => {
          if (channelsResponse.channels.length < 2) {
            //  There are fewer than the expected number of public channels on this keyset, do any required Keyset initialization
            await keysetInit(localChat)
            location.reload()
          } else {
            //  Join public channels
            if (channelsResponse.channels.length > 0) {
              setLoadMessage('Creating Memberships')
              //  Join each of the public channels
              const currentMemberships = await localChat.currentUser.getMemberships({
                filter: "channel.type == 'public'"
              })

              //  Test to see if we are already a member of the public channels, and if not, join them.
              const publicMembership =
                await currentMemberships.memberships.find(
                  membership => membership.channel.id == 'public-general'
                )
              const workMembership = await currentMemberships.memberships.find(
                membership => membership.channel.id == 'public-work'
              )
              if (!publicMembership) {
                const publicChannel = await localChat.getChannel('public-general')
                publicChannel?.join(message => {
                  //  We have a message listener elsewhere for consistency with private and direct chats
                })
              }
              if (!workMembership) {
                const workChannel = await localChat.getChannel('public-work')
                workChannel?.join(message => {
                  //  We have a message listener elsewhere for consistency with private and direct chats
                })
              }
            }
          }
        })

      //  Initialization for private groups and direct messages
      //  Calling inside a timeout as there was some timing issue when creating a new user
      let setTimeoutIdInit = setTimeout(() => {
        updateChannelMembershipsForPublic(localChat)
        updateChannelMembershipsForDirects(localChat)
        updateChannelMembershipsForGroups(localChat)
      }, 500)

      actionCompleted({
        action: 'Login',
        blockDuplicateCalls: false,
        debug: false
      })
    }
    if (chat) return
    init()
  }, [userId, chat, searchParams, router])

  useEffect(() => {
    //  Connect to the direct chats whenever they change so we can keep a track of unread messages
    //  Called once everything is initialized
    if (!chat) return
    if (!publicChannels) return
    if (!directChats) return
    if (!privateGroups) return
    if (!activeChannel) return

    function updateUnreadMessagesCounts () {
      chat?.getUnreadMessagesCounts({}).then(result => {
        let unreadMessagesOnChannel: UnreadMessagesOnChannel[] = []
        result.forEach((element, index) => {
          let newUnreadMessage: UnreadMessagesOnChannel = {
            channel: element.channel,
            count: element.count
          }
          unreadMessagesOnChannel.push(newUnreadMessage)
        })
        setUnreadMessages(unreadMessagesOnChannel)
      })
    }

    var publicHandlers: (() => void)[] = []
    publicChannels.forEach((channel, index) => {
      const disconnectHandler = channel.connect(message => {
        if (
          !(
            message.userId == chat.currentUser.id ||
            message.channelId == activeChannel.id
          )
        ) {
          updateUnreadMessagesCounts()
        }
      })
      publicHandlers.push(disconnectHandler)
    })
    var directHandlers: (() => void)[] = []
    directChats.forEach((channel, index) => {
      const disconnectHandler = channel.connect(message => {
        if (
          !(
            message.userId == chat.currentUser.id ||
            message.channelId == activeChannel.id
          )
        ) {
          updateUnreadMessagesCounts()
        }
      })
      directHandlers.push(disconnectHandler)
    })
    var privateHandlers: (() => void)[] = []
    privateGroups.forEach((channel, index) => {
      const disconnectHandler = channel.connect(message => {
        if (
          !(
            message.userId == chat.currentUser.id ||
            message.channelId == activeChannel.id
          )
        ) {
          updateUnreadMessagesCounts()
        }
      })
      privateHandlers.push(disconnectHandler)
    })

    updateUnreadMessagesCounts() //  Update the unread message counts whenever the channel changes

    return () => {
      publicHandlers.forEach(handler => {
        handler()
      })
      directHandlers.forEach(handler => {
        handler()
      })
      privateHandlers.forEach(handler => {
        handler()
      })
    }
  }, [chat, publicChannels, directChats, activeChannel, privateGroups])

  //  Invoked whenever the active channel changes
  useEffect(() => {
    if (!chat) return
    if (!activeChannel) return

    //  Set the pinned message for the active channel, this returns an updated channel ID so retrieve based on the server-channel
    chat.getChannel(activeChannel.id).then(localActiveChannel => {
      localActiveChannel
        ?.getPinnedMessage()
        .then(localActiveChannelPinnedMessage => {
          setActiveChannelPinnedMessage(localActiveChannelPinnedMessage)
        })
    })

    //  Only register typing indicators for non-public channels
    if (activeChannel.type == 'public') return
    return activeChannel.getTyping(value => {
      const findMe = value.indexOf(chat.currentUser.id)
      if (findMe > -1) value.splice(findMe, 1)
      setTypingData(value)
    })
  }, [chat, activeChannel])

  useEffect(() => {
    //  This use effect is only called once after the local user cache has been initialized
    if (chat && publicChannelsUsers?.length > 0 && initOnce == 0) {
      setInitOnce(1)
      if (publicChannels) {
        setActiveChannel(publicChannels[0])
        sendChatEvent(ChatEventTypes.JOINED, publicChannelsUsers[0], {
          userId: chat.currentUser.id
        })
        updateUnreadMessagesCounts() //  Update the unread message counts whenever the channel changes
      } else {
        console.log('Error: Public Channels was undefined at launch')
      }
    }
  }, [chat, publicChannelsUsers, initOnce])

  useEffect(() => {
    //  Get updates on the current user's name and profile URL
    if (!currentUser) return
    return currentUser.streamUpdates(updatedUser => {
      if (updatedUser.name) {
        setName(updatedUser.name)
      }
      if (updatedUser.profileUrl) {
        setProfileUrl(updatedUser.profileUrl)
      }
    })
  }, [currentUser])

  /* Handle updates to the Public Channels */
  useEffect(() => {
    if (chat && publicChannels && publicChannels.length > 0) {
      return Channel.streamUpdatesOn(publicChannels, channels => {
        const updatedPublicChannels = publicChannels.map(
          (publicChannel, index) => {
            if (channels[index].name) {
              ;(publicChannel as any).name = channels[index].name
            }
            if (channels[index].custom?.profileUrl) {
              publicChannel.custom.profileUrl =
                channels[index].custom.profileUrl
            }
            return publicChannel
          }
        )
        setPublicChannels(updatedPublicChannels)
      })
    }
  }, [chat, publicChannels])

  /* Handle updates to the Private Groups */
  useEffect(() => {
    if (chat && privateGroups && privateGroups.length > 0) {
      return Channel.streamUpdatesOn(privateGroups, channels => {
        const updatedPrivateGroups = privateGroups.map(
          (privateGroup, index) => {
            if (channels[index].name) {
              ;(privateGroup as any).name = channels[index].name
            }
            return privateGroup
          }
        )
        setPrivateGroups(updatedPrivateGroups)
      })
    }
  }, [chat, privateGroups])

  /* Handle updates to the Direct Message Groups */
  useEffect(() => {
    if (chat && directChats && directChats.length > 0) {
      //  Note: We do not need to stream updates on direct chats since we do not use the channel name, only the user info (name, avatar)
    }
  }, [chat, directChats])

  /* Listen for events using the Chat event mechanism*/
  useEffect(() => {
    if (!chat) return
    const removeCustomListener = chat.listenForEvents({
      channel: chat.currentUser.id,
      type: 'custom',
      method: 'publish',
      callback: async evt => {
        switch (evt.payload.action) {
          case ChatEventTypes.LEAVE:
            //  Someone is telling us they are leaving a group
            if (evt.payload.body.isDirectChat) {
              //  Our partner left the direct chat, leave it ourselves
              const channel = await chat.getChannel(evt.payload.body.channelId)
              await channel?.leave()
              if (activeChannel?.id === evt.payload.body.channelId) {
                if (publicChannels) {
                  setActiveChannel(publicChannels[0])
                }
              }
            }
            refreshMembersFromServer()
            break
          case ChatEventTypes.JOINED:
            //  Someone has joined one of the public channels
            refreshMembersFromServer()
            break
        }
      }
    })

    const removeModerationListener = chat.listenForEvents({
      channel: `PUBNUB_INTERNAL_MODERATION.${chat.currentUser.id}`,
      type: 'moderation',
      callback: async evt => {
        let moderationMessage = ''
        let notificationSeverity: ToastType = ToastType.INFO
        if (evt.payload.restriction == 'muted') {
          moderationMessage = `You have been MUTED by the administrator`
          notificationSeverity = ToastType.ERROR
        } else if (evt.payload.restriction == 'banned') {
          moderationMessage = `You have been BANNED by the administrator for the following reason: ${evt.payload.reason}`
          notificationSeverity = ToastType.ERROR
        } else if (evt.payload.restriction == 'lifted') {
          moderationMessage = `Your previous restrictions have been LIFTED by the administrator`
          notificationSeverity = ToastType.CHECK
        }
        showUserMessage(
          'Moderation Event:',
          moderationMessage,
          'https://www.pubnub.com/how-to/monitor-and-moderate-conversations-with-bizops-workspace/',
          notificationSeverity
        )
      }
    })

    const removeMentionsListener = chat.listenForEvents({
      user: chat.currentUser.id,
      type: 'mention',
      callback: async evt => {
        const channelId = evt.payload.channel
        const messageTimetoken = evt.payload.messageTimetoken
        const channel = await chat.getChannel(channelId)
        const message = await channel?.getMessage(messageTimetoken)
        showUserMessage(
          'You Were Mentioned:',
          'You have been mentioned in the following message: ' +
            message?.content.text,
          'https://www.pubnub.com/docs/chat/chat-sdk/build/features/custom-events#events-for-mentions',
          ToastType.INFO
        )
      }
    })

    const removeInvite = chat.listenForEvents({
      channel: chat.currentUser.id,
      type: 'invite',
      callback: async evt => {
        //  Somebody has added us to a new group chat or DM
        refreshMembersFromServer()
      }
    })

    return () => {
      removeCustomListener()
      removeModerationListener()
      removeMentionsListener()
      removeInvite()
    }
  }, [chat])

  /* 
  Will refresh all of the users and channels associated with this user's memberships
  You could do this using the objects from the StreamUpdatesOn() callbacks, but 
  this way is expedient for a proof of concept.  The Channel name updates use the StreamUpdatesOn() 
  callback directly.
  */
  const refreshMembersFromServer = useCallback(
    async (
      forceUpdateDirectChannels = false,
      forceUpdateGroupChannels = false,
      desiredChannelId = ''
    ) => {
      if (!chat) return
      //return //  TODO REMOVE THIS TO ENABLE OBJECT UPDATES.  IT'S JUST A PAIN WHEN DEBUGGING

      clearTimeout(refreshMembersTimeoutId)

      if (forceUpdateDirectChannels) {
        //updateChannelMembershipsForPublic(chat)  //  Not needed as we only call this when we create a new group or DM
        updateChannelMembershipsForDirects(chat, desiredChannelId)
      } else if (forceUpdateGroupChannels) {
        updateChannelMembershipsForGroups(chat, desiredChannelId)
      } else {
        let setTimeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
          updateChannelMembershipsForPublic(chat)
          updateChannelMembershipsForDirects(chat)
          updateChannelMembershipsForGroups(chat)
        }, 3000)
        setRefreshMembersTimeoutId(setTimeoutId)
      }

      return
    },
    [chat, refreshMembersTimeoutId]
  )

  function sendChatEvent (
    eventType: ChatEventTypes,
    recipients: User[],
    payload
  ) {
    recipients.forEach(async recipient => {
      //  Don't send the message to myself
      if (recipient.id !== chat?.currentUser.id) {
        await chat?.emitEvent({
          channel: recipient.id,
          type: 'custom',
          method: 'publish',
          payload: {
            action: eventType,
            body: payload
          }
        })
      }
    })
  }

  async function messageActionHandler (action, data) {
    switch (action) {
      case MessageActionsTypes.REPLY_IN_THREAD:
        setShowThread(true)
        setChatSelectionMenuMinimized(true)
        //  The data parameter is the message we are to reply to
        if (!data.hasThread) {
          setActiveThreadChannel(await data.createThread())
        } else {
          setActiveThreadChannel(await data.getThread())
        }
        setActiveThreadMessage(data)
        actionCompleted({
          action: "Open a Message's Thread",
          blockDuplicateCalls: false,
          debug: false
        })
        break
      case MessageActionsTypes.QUOTE:
        setQuotedMessage(data)
        chat?.getUser(data.userId).then(user => {
          if (user && user.name) {
            setQuotedMessageSender(user.name)
          }
        })
        actionCompleted({
          action: 'Quote a Message',
          blockDuplicateCalls: false,
          debug: false
        })
        break
      case MessageActionsTypes.PIN:
        if (activeChannel) {
          //  The data parameter is the message we are to reply to
          let localActiveChannel = await chat?.getChannel(activeChannel?.id)
          const localActiveChannelPinnedMessage =
            await localActiveChannel?.getPinnedMessage()
          //  Check whether we need to unpin an existing message first
          if (localActiveChannelPinnedMessage) {
            localActiveChannel = await localActiveChannel?.unpinMessage()
          } else {
            //  There was no message, so did not unpin anything'
          }
          //  Channel now has no pinned message.  Pin the requested message if it is different from
          //  the one we just unpinned
          if (localActiveChannelPinnedMessage?.timetoken != data.timetoken) {
            localActiveChannel = await localActiveChannel?.pinMessage(data)
            showUserMessage(
              'Message Pinned:',
              'The Message has been pinned to the top of ' + activeChannel.name,
              'https://www.pubnub.com/docs/chat/chat-sdk/build/features/messages/pinned',
              ToastType.CHECK
            )
            actionCompleted({
              action: 'Pin a Message',
              blockDuplicateCalls: false,
              debug: false
            })
          }
        }
        break
      case MessageActionsTypes.COPY:
        showUserMessage('Copied', `${data.text}`, '', ToastType.CHECK)
        break
      case MessageActionsTypes.SHOW_EMOJI:
        setEmojiPickerTargetsInput(false)
        setShowEmojiMessageTimetoken(data.messageTimetoken)
        //  Avoid interference from the logic that hides the picker when you click outside it
        setTimeout(function () {
          setShowEmojiPicker(data.isShown)
        }, 50)
        break
    }
  }

  function logout () {
    const identifier = searchParams.get('identifier')
    if (identifier)
      {
        router.replace(`/?identifier=${identifier}`)
      }
      else
      {
        router.replace(`/`)
      }
  }

  function showUserMessage (
    title: string,
    message: string,
    href: string,
    type = ToastType.INFO
  ) {
    clearTimeout(userMsgTimeoutId)
    setUserMsg({ message: message, href: href, title: title, type: type })
    setUserMsgShown(true)
    let timeoutId = window.setTimeout(setUserMsgShown, 7000, false)
    setUserMsgTimeoutId(timeoutId)
  }

  function closeUserMessage () {
    clearTimeout(userMsgTimeoutId)
    setUserMsgShown(false)
  }

  if (!chat) {
    return (
      <main>
        <div className='flex flex-col w-full h-screen justify-center items-center'>
          <div className='max-w-96 max-h-96 '>
            <Image
              src='/chat-logo.svg'
              alt='Chat Icon'
              className=''
              width={1000}
              height={1000}
              priority
            />
          </div>
          <div className='flex mb-5 animate-spin'>
            <Image
              src='/icons/loading.png'
              alt='Chat Icon'
              className=''
              width={50}
              height={50}
              priority
            />
          </div>
          <div className='text-2xl select-none'>{loadMessage}</div>
        </div>
      </main>
    )
  }

  return (
    <main className='overscroll-none overflow-y-hidden'>
      <RoomSelector
        roomSelectorVisible={roomSelectorVisible}
        setRoomSelectorVisible={setRoomSelectorVisible}
      />
      <ProfileScreen
        profileScreenVisible={profileScreenVisible}
        setProfileScreenVisible={setProfileScreenVisible}
        changeUserNameScreenVisible={changeUserNameModalVisible}
        name={name}
        profileUrl={profileUrl}
        logout={() => logout()}
        changeName={() => {
          setChangeUserNameModalVisible(true)
        }}
        showUserMessage={showUserMessage}
      />
      <ChatSettingsScreen
        chatSettingsScreenVisible={chatSettingsScreenVisible}
        setChatSettingsScreenVisible={setChatSettingsScreenVisible}
        changeChatNameScreenVisible={changeChatNameModalVisible}
        manageMembersModalVisible={manageMembersModalVisible}
        isDirectChat={activeChannel?.type == 'direct'}
        activeChannel={activeChannel}
        activeChannelUsers={
          activeChannel?.type == 'group' && privateGroups
            ? privateGroupsUsers[
                privateGroups.findIndex(group => group.id == activeChannel?.id)
              ]
            : activeChannel?.type == 'direct' && directChats
            ? directChatsUsers[
                directChats.findIndex(
                  dmChannel => dmChannel.id == activeChannel?.id
                )
              ]
            : publicChannels
            ? publicChannelsUsers[
                publicChannels.findIndex(
                  channel => channel.id == activeChannel?.id
                )
              ]
            : []
        }
        buttonAction={async () => {
          if (activeChannel && publicChannels) {
            sendChatEvent(
              ChatEventTypes.LEAVE,
              activeChannel.type == 'group' && privateGroups
                ? privateGroupsUsers[
                    privateGroups.findIndex(
                      group => group.id == activeChannel?.id
                    )
                  ]
                : activeChannel.type == 'direct' && directChats
                ? directChatsUsers[
                    directChats.findIndex(
                      dmChannel => dmChannel.id == activeChannel?.id
                    )
                  ]
                : [],
              {
                userLeaving: chat.currentUser.id,
                isDirectChat: activeChannel.type != 'group',
                channelId: activeChannel.id
              }
            )
            await activeChannel.leave()
            showUserMessage(
              'You Left:',
              'You have left this group, please select a different channel or create a new group / DM',
              'https://www.pubnub.com/docs/chat/chat-sdk/build/features/channels/updates#update-channel-details'
            )
            actionCompleted({
              action: 'Leave a Private Group',
              blockDuplicateCalls: false,
              debug: false
            })
            if (publicChannels.length > 0) {
              setActiveChannel(publicChannels[0])
            }
            setChatSettingsScreenVisible(false)
            refreshMembersFromServer()
          }
        }}
        changeChatNameAction={() => {
          setChangeChatNameModalVisible(true)
        }}
        manageMembershipsAction={() => {
          setManageMembersModalVisible(true)
        }}
        showUserMessage={showUserMessage}
      />
      {/* Modal to change the Chat group name*/}
      <ModalChangeName
        name={name}
        activeChannel={activeChannel}
        modalType={ChatNameModals.CHANNEL}
        showUserMessage={showUserMessage}
        saveAction={async newName => {
          await activeChannel?.update({
            name: newName
          })
          showUserMessage(
            'Channel Name Changed',
            'The channel name has been successfully updated',
            'https://www.pubnub.com/docs/chat/chat-sdk/build/features/channels/updates#update-channel-details',
            ToastType.CHECK
          )
          actionCompleted({
            action: 'Change the Private Group name',
            blockDuplicateCalls: false,
            debug: false
          })
        }}
        changeNameModalVisible={changeChatNameModalVisible}
        setChangeNameModalVisible={setChangeChatNameModalVisible}
      />
      <ModalManageMembers
        activeChannelUsers={
          activeChannel?.type == 'group' && privateGroups
            ? privateGroupsUsers[
                privateGroups.findIndex(group => group.id == activeChannel?.id)
              ]
            : activeChannel?.type == 'direct' && directChats
            ? directChatsUsers[
                directChats.findIndex(
                  dmChannel => dmChannel.id == activeChannel?.id
                )
              ]
            : activeChannel?.type == 'public' && publicChannels
            ? publicChannelsUsers[
                publicChannels.findIndex(
                  channel => channel.id == activeChannel?.id
                )
              ]
            : []
        }
        currentUserId={chat.currentUser.id}
        activeChannel={activeChannel}
        saveAction={() => {
          setManageMembersModalVisible(false)
        }}
        sendChatEvent={(eventType, recipients, payload) => {
          sendChatEvent(eventType, recipients, payload)
        }}
        manageMembersModalVisible={manageMembersModalVisible}
        setManageMembersModalVisible={setManageMembersModalVisible}
      />
      {/* Modal to change the user name */}
      <ModalChangeName
        name={name}
        activeChannel={null}
        modalType={ChatNameModals.USER}
        saveAction={async newName => {
          const newUser = await chat.currentUser.update({
            name: newName
          })
          setCurrentUser(newUser)
          setName(newName)
          showUserMessage(
            'Name Changed',
            'Your name has been successfully updated',
            'https://www.pubnub.com/docs/chat/chat-sdk/build/features/users/updates#update-user-details',
            ToastType.CHECK
          )
        }}
        showUserMessage={showUserMessage}
        changeNameModalVisible={changeUserNameModalVisible}
        setChangeNameModalVisible={setChangeUserNameModalVisible}
      />

      <Header
        setRoomSelectorVisible={setRoomSelectorVisible}
        setProfileScreenVisible={setProfileScreenVisible}
        showNotificationBadge={true}
        showMentionsBadge={false}
        creatingNewMessage={creatingNewMessage}
        setCreatingNewMessage={setCreatingNewMessage}
        showUserMessage={showUserMessage}
        guidedDemo={guidedDemo}
      />
      <UserMessage
        userMsgShown={userMsgShown}
        title={userMsg.title}
        message={userMsg.message}
        href={userMsg.href}
        type={userMsg.type}
        closeToastAction={() => {
          closeUserMessage()
        }}
      />
      <div
        className={`${
          !showEmojiPicker && 'hidden'
        } absolute left-2 bottom-2 z-50 bg-white`}
      >
        <Picker
          data={data}
          sheetRows={3}
          previewPosition={'none'}
          navPosition={'none'}
          searchPosition={'none'}
          maxFrequentRows={0}
          onEmojiSelect={data => {
            emojiSelected(data)
          }}
          onClickOutside={() => {
            setShowEmojiPicker(false)
          }}
        />
      </div>
      <div
        id='chat-main'
        className={`flex flex-row min-h-screen h-screen overscroll-none  ${
          (roomSelectorVisible ||
            profileScreenVisible ||
            chatSettingsScreenVisible ||
            changeChatNameModalVisible ||
            manageMembersModalVisible) &&
          'blur-sm opacity-40'
        }`}
      >
        <ChatSelectionMenu
          chatSelectionMenuMinimized={chatSelectionMenuMinimized}
          setChatSelectionMenuMinimized={setChatSelectionMenuMinimized}
          setShowThread={setShowThread}
          chat={chat}
          setCreatingNewMessage={setCreatingNewMessage}
          unreadMessages={unreadMessages}
          publicChannels={publicChannels}
          publicChannelsMemberships={publicChannelsMemberships}
          privateGroups={privateGroups}
          privateGroupsUsers={privateGroupsUsers}
          privateGroupsMemberships={privateGroupsMemberships}
          directChats={directChats}
          directChatsUsers={directChatsUsers}
          directChatsMemberships={directChatsMemberships}
          activeChannel={setActiveChannel}
          setActiveChannel={setActiveChannel}
          setActiveChannelPinnedMessage={setActiveChannelPinnedMessage}
          updateUnreadMessagesCounts={() => {
            updateUnreadMessagesCounts()
          }}
          currentUserProfileUrl={profileUrl}
          showUserMessage={showUserMessage}
        />
        <div className='relative w-full bg-white'>
          <div
            id='chats-main'
            className='flex flex-col grow w-full max-h-screen py-0 mt-[64px] bg-white'
          >
            {creatingNewMessage ? (
              <NewMessageGroup
                chat={chat}
                currentUser={currentUser}
                setCreatingNewMessage={setCreatingNewMessage}
                showUserMessage={showUserMessage}
                sendChatEvent={(eventType, recipients, payload) => {
                  sendChatEvent(eventType, recipients, payload)
                }}
                invokeRefresh={(desiredChannelId, createdType) => {
                  refreshMembersFromServer(
                    createdType == 'direct',
                    createdType == 'group',
                    desiredChannelId
                  )
                }}
              />
            ) : (
              <MessageList
                activeChannel={activeChannel}
                currentUser={chat.currentUser}
                quotedMessageSender={''}
                groupUsers={
                  activeChannel?.type == 'group' && privateGroups
                    ? privateGroupsUsers[
                        privateGroups.findIndex(
                          group => group.id == activeChannel?.id
                        )
                      ]
                    : activeChannel?.type == 'direct' && directChats
                    ? directChatsUsers[
                        directChats.findIndex(
                          dmChannel => dmChannel.id == activeChannel?.id
                        )
                      ]
                    : publicChannels
                    ? publicChannelsUsers[
                        publicChannels.findIndex(
                          channel => channel.id == activeChannel?.id
                        )
                      ]
                    : []
                }
                groupMembership={
                  activeChannel?.type == 'group' &&
                  privateGroups &&
                  privateGroupsMemberships
                    ? privateGroupsMemberships[
                        privateGroups.findIndex(
                          group => group.id == activeChannel?.id
                        )
                      ]
                    : activeChannel?.type == 'direct' &&
                      directChats &&
                      directChatsMemberships
                    ? directChatsMemberships[
                        directChats.findIndex(
                          dmChannel => dmChannel.id == activeChannel?.id
                        )
                      ]
                    : activeChannel?.type == 'public' &&
                      publicChannels &&
                      publicChannelsMemberships
                    ? publicChannelsMemberships[
                        publicChannels.findIndex(
                          channel => channel.id == activeChannel?.id
                        )
                      ]
                    : null
                }
                messageActionHandler={(action, vars) =>
                  messageActionHandler(action, vars)
                }
                usersHaveChanged={() => {
                  refreshMembersFromServer()
                }}
                updateUnreadMessagesCounts={() => {
                  updateUnreadMessagesCounts()
                }}
                setChatSettingsScreenVisible={setChatSettingsScreenVisible}
                quotedMessage={quotedMessage}
                activeChannelPinnedMessage={activeChannelPinnedMessage}
                setActiveChannelPinnedMessage={setActiveChannelPinnedMessage}
                setShowThread={setShowThread}
                showUserMessage={showUserMessage}
              />
            )}
            {!quotedMessage &&
              typingData &&
              typingData.length > 0 &&
              activeChannel?.type !== 'public' && (
                <TypingIndicator
                  typers={typingData}
                  users={
                    activeChannel?.type == 'group' && privateGroups
                      ? privateGroupsUsers[
                          privateGroups.findIndex(
                            group => group.id == activeChannel?.id
                          )
                        ]
                      : activeChannel?.type == 'direct' && directChats
                      ? directChatsUsers[
                          directChats.findIndex(
                            dmChannel => dmChannel.id == activeChannel?.id
                          )
                        ]
                      : []
                  }
                />
              )}
            <div
              className={`${
                creatingNewMessage && 'hidden'
              } absolute bottom-0 left-0 right-0 bg-white`}
            >
              <MessageInput
                activeChannel={activeChannel}
                replyInThread={false}
                quotedMessage={quotedMessage}
                quotedMessageSender={quotedMessageSender}
                setQuotedMessage={setQuotedMessage}
                creatingNewMessage={creatingNewMessage}
                showUserMessage={showUserMessage}
                setEmojiPickerTargetsInput={() =>
                  setEmojiPickerTargetsInput(true)
                }
                setShowEmojiPicker={() => {
                  setTimeout(function () {
                    setShowEmojiPicker(!showEmojiPicker)
                  }, 50)
                }}
                selectedEmoji={selectedEmoji}
                setSelectedEmoji={setSelectedEmoji}
              />
            </div>
          </div>
        </div>
        <MessageListThread
          showThread={showThread && !creatingNewMessage}
          setShowThread={setShowThread}
          setChatSelectionMenuMinimized={setChatSelectionMenuMinimized}
          activeThreadChannel={activeThreadChannel}
          activeThreadMessage={activeThreadMessage}
          currentUser={chat.currentUser}
          groupUsers={
            activeChannel?.type == 'group' && privateGroups
              ? privateGroupsUsers[
                  privateGroups.findIndex(
                    group => group.id == activeChannel?.id
                  )
                ]
              : activeChannel?.type == 'direct' && directChats
              ? directChatsUsers[
                  directChats.findIndex(
                    dmChannel => dmChannel.id == activeChannel?.id
                  )
                ]
              : publicChannels
              ? publicChannelsUsers[
                  publicChannels.findIndex(
                    channel => channel.id == activeChannel?.id
                  )
                ]
              : []
          }
        />
      </div>
    </main>
  )
}
